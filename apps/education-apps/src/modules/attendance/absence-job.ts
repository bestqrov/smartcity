import cron from 'node-cron';
import prisma from '../../config/database';
import { holidayOn, parseTimeOnDate, slotsOnDate, startOfDay, TimeSlot } from '../../utils/attendanceStatus';
import { ConsoleNotificationProvider } from '../notifications/notification.provider';
import { sendAttendanceNotification } from '../notifications/notification.service';
import { absentMessage } from './attendance.messages';
import { findSessionRecord } from './attendance.service';

const GRACE_PERIOD_MINUTES = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Marks ABSENT every enrolled student nobody scanned (or marked by hand) for each of today's
 * sessions that ended more than GRACE_PERIOD_MINUTES ago, and tells the parent. Skips
 * branches on holiday. Safe to run repeatedly: a session already recorded is left alone.
 */
export const runAbsenceSweep = async (): Promise<void> => {
    const now = new Date();
    const today = startOfDay(now);

    const [groups, holidays] = await Promise.all([
        prisma.group.findMany({ include: { students: true } }),
        prisma.holiday.findMany({
            where: {
                active: true,
                startDate: { lt: new Date(today.getTime() + 2 * DAY_MS) },
                endDate: { gte: new Date(today.getTime() - DAY_MS) },
            },
        }),
    ]);

    for (const group of groups) {
        const todaySlots = slotsOnDate((group.timeSlots as unknown as TimeSlot[]) || [], today);
        if (todaySlots.length === 0 || group.students.length === 0) continue;

        const branchHolidays = holidays.filter((h) => h.branchId === group.branchId);
        if (holidayOn(branchHolidays, today)) continue;

        const dueSlots = todaySlots.filter((slot) => {
            const deadline = parseTimeOnDate(now, slot.endTime).getTime() + GRACE_PERIOD_MINUTES * 60_000;
            return now.getTime() >= deadline;
        });
        if (dueSlots.length === 0) continue;

        let todayRecords;
        try {
            todayRecords = await prisma.attendance.findMany({ where: { groupId: group.id, date: today } });
        } catch (error) {
            console.error(`[absence-job] failed to load attendance for group ${group.id}:`, error);
            continue;
        }

        for (const slot of dueSlots) {
            for (const student of group.students) {
                try {
                    const studentRecords = todayRecords.filter((r) => r.studentId === student.id);
                    if (findSessionRecord(studentRecords, slot.startTime, todaySlots[0].startTime)) continue;

                    const attendance = await prisma.attendance.create({
                        data: {
                            studentId: student.id,
                            groupId: group.id,
                            branchId: group.branchId,
                            date: today,
                            slotStart: slot.startTime,
                            status: 'ABSENT',
                            source: 'AUTO',
                        },
                    });
                    todayRecords.push(attendance);

                    if (student.parentId) {
                        const fullName = `${student.name} ${student.surname || ''}`.trim();
                        await sendAttendanceNotification(new ConsoleNotificationProvider(), {
                            attendanceId: attendance.id,
                            parentId: student.parentId,
                            channel: 'WHATSAPP',
                            message: absentMessage(fullName, group.name, slot.startTime, slot.endTime),
                        });
                    }
                } catch (error) {
                    // P2002: a scan or a manual mark landed between our read and this write — fine.
                    if ((error as any)?.code === 'P2002') continue;
                    console.error(`[absence-job] failed to process student ${student.id} in group ${group.id}:`, error);
                }
            }
        }
    }
};

let sweepInProgress = false;

export const startAbsenceCronJob = (): void => {
    cron.schedule('*/10 * * * *', () => {
        if (sweepInProgress) {
            console.warn('[absence-job] previous sweep still running, skipping this tick');
            return;
        }
        sweepInProgress = true;
        runAbsenceSweep()
            .catch((error) => {
                console.error('[absence-job] sweep failed:', error);
            })
            .finally(() => {
                sweepInProgress = false;
            });
    });
};
