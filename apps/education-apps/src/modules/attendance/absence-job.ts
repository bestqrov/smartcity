import cron from 'node-cron';
import prisma from '../../config/database';
import { TimeSlot, WEEKDAY_NAMES, parseTimeOnDate } from '../../utils/attendanceStatus';
import { ConsoleNotificationProvider } from '../notifications/notification.provider';
import { sendAttendanceNotification } from '../notifications/notification.service';

const GRACE_PERIOD_MINUTES = 10;

export const runAbsenceSweep = async (): Promise<void> => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayName = WEEKDAY_NAMES[now.getDay()];

    const groups = await prisma.group.findMany({ include: { students: true } });

    for (const group of groups) {
        const timeSlots = (group.timeSlots as unknown as TimeSlot[]) || [];
        const todaySlots = timeSlots.filter((slot) => slot.day === dayName);
        if (todaySlots.length === 0) continue;

        for (const todaySlot of todaySlots) {
            const slotEnd = parseTimeOnDate(now, todaySlot.endTime);
            const sweepDeadline = new Date(slotEnd.getTime() + GRACE_PERIOD_MINUTES * 60_000);
            if (now.getTime() < sweepDeadline.getTime()) continue;

            for (const student of group.students) {
                try {
                    const existing = await prisma.attendance.findUnique({
                        where: {
                            studentId_groupId_date: {
                                studentId: student.id,
                                groupId: group.id,
                                date: today,
                            },
                        },
                    });
                    if (existing) continue;

                    const attendance = await prisma.attendance.create({
                        data: {
                            studentId: student.id,
                            groupId: group.id,
                            date: today,
                            status: 'ABSENT',
                        },
                    });

                    if (student.parentId) {
                        await sendAttendanceNotification(new ConsoleNotificationProvider(), {
                            attendanceId: attendance.id,
                            parentId: student.parentId,
                            channel: 'WHATSAPP',
                            message: `Your child ${student.name} did not check in to class today.`,
                        });
                    }
                } catch (error) {
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
