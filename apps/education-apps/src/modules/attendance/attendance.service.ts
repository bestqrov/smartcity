import prisma from '../../config/database';
import { hashToken } from '../../utils/accessToken';
import {
    holidayOn,
    parseDateKey,
    parseTimeOnDate,
    resolveScanSession,
    slotsOnDate,
    startOfDay,
    TimeSlot,
    toDateKey,
} from '../../utils/attendanceStatus';
import { ConsoleNotificationProvider } from '../notifications/notification.provider';
import { sendAttendanceNotification } from '../notifications/notification.service';
import { arrivedMessage, lateMessage } from './attendance.messages';

export const MARKABLE_STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'JUSTIFIED'] as const;
export type MarkableStatus = (typeof MARKABLE_STATUSES)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

interface AttendanceRecordLike {
    slotStart?: string | null;
}

/**
 * Finds the record for one session among a student's records of that day. Records written
 * before sessions were tracked have no slotStart: they belong to the day's first session.
 */
export const findSessionRecord = <R extends AttendanceRecordLike>(
    dayRecords: R[],
    slotStart: string,
    firstSlotStart: string | undefined
): R | undefined =>
    dayRecords.find((r) => r.slotStart === slotStart) ||
    (slotStart === firstSlotStart ? dayRecords.find((r) => r.slotStart == null) : undefined);

export const getAttendanceByStudent = async (studentId: string, branchId: string) => {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.branchId !== branchId) {
        throw new Error('Student not found');
    }

    return prisma.attendance.findMany({
        where: { studentId, branchId },
        include: { group: { select: { id: true, name: true } } },
        orderBy: [{ date: 'desc' }, { slotStart: 'desc' }],
    });
};

export const scanAttendance = async (rawStudentToken: string, groupId: string, branchId: string) => {
    const accessTokenHash = hashToken(rawStudentToken);

    const student = await prisma.student.findUnique({
        where: { accessTokenHash },
    });

    if (!student || student.branchId !== branchId) {
        throw new Error('Student not found');
    }

    if (!student.groupIds.includes(groupId)) {
        throw new Error('Student is not enrolled in this group');
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group || group.branchId !== branchId) {
        throw new Error('Group not found');
    }

    const now = new Date();
    const today = startOfDay(now);
    const timeSlots = (group.timeSlots as unknown as TimeSlot[]) || [];
    const { slot, status } = resolveScanSession(timeSlots, now);

    const dayRecords = await prisma.attendance.findMany({
        where: { studentId: student.id, groupId, date: today },
    });
    if (findSessionRecord(dayRecords, slot.startTime, slotsOnDate(timeSlots, today)[0]?.startTime)) {
        throw new Error('Attendance already marked for this session');
    }

    let attendance;
    try {
        attendance = await prisma.attendance.create({
            data: {
                studentId: student.id,
                groupId,
                branchId,
                date: today,
                slotStart: slot.startTime,
                scannedAt: now,
                status,
                source: 'SCAN',
            },
        });
    } catch (error) {
        if ((error as any)?.code === 'P2002') {
            throw new Error('Attendance already marked for this session');
        }
        throw error;
    }

    if (student.parentId) {
        const fullName = `${student.name} ${student.surname || ''}`.trim();
        const message = status === 'LATE'
            ? lateMessage(fullName, group.name, now)
            : arrivedMessage(fullName, group.name, now);

        try {
            await sendAttendanceNotification(new ConsoleNotificationProvider(), {
                attendanceId: attendance.id,
                parentId: student.parentId,
                channel: 'WHATSAPP',
                message,
            });
        } catch (error) {
            console.error('[attendance] failed to send notification, attendance was still recorded:', error);
        }
    }

    return attendance;
};

/**
 * Everything the weekly grid needs for one group: the 7 days (Monday first) with that day's
 * sessions from the group's timetable, holidays, the enrolled students and their records.
 */
export const getWeeklyAttendance = async (groupId: string, weekOf: string, branchId: string) => {
    const anyDay = parseDateKey(weekOf);
    if (!anyDay) {
        throw new Error('Invalid week date (expected YYYY-MM-DD)');
    }

    const monday = new Date(anyDay);
    monday.setDate(anyDay.getDate() - ((anyDay.getDay() + 6) % 7));
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);

    const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
            students: { select: { id: true, name: true, surname: true } },
            teacher: { select: { name: true } },
        },
    });
    if (!group || group.branchId !== branchId) {
        throw new Error('Group not found');
    }

    const [records, holidays] = await Promise.all([
        prisma.attendance.findMany({
            where: { groupId, branchId, date: { gte: monday, lt: nextMonday } },
        }),
        // Holidays are stored at UTC midnight: widen the window by a day on each side and let
        // holidayOn() do the exact calendar-day comparison.
        prisma.holiday.findMany({
            where: {
                branchId,
                active: true,
                startDate: { lt: new Date(nextMonday.getTime() + DAY_MS) },
                endDate: { gte: new Date(monday.getTime() - DAY_MS) },
            },
        }),
    ]);

    const timeSlots = (group.timeSlots as unknown as TimeSlot[]) || [];

    const days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        return {
            date: toDateKey(date),
            holiday: holidayOn(holidays, date)?.title || null,
            slots: slotsOnDate(timeSlots, date).map(({ startTime, endTime }) => ({ startTime, endTime })),
        };
    });

    const firstSlotByDay = new Map(days.map((d) => [d.date, d.slots[0]?.startTime]));

    const students = [...group.students].sort((a, b) =>
        `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`, 'fr')
    );

    return {
        group: {
            id: group.id,
            name: group.name,
            type: group.type,
            room: group.room,
            teacherName: group.teacher?.name ?? null,
        },
        weekStart: toDateKey(monday),
        days,
        students,
        records: records.map((r) => {
            const date = toDateKey(r.date);
            return {
                id: r.id,
                studentId: r.studentId,
                date,
                slotStart: r.slotStart ?? firstSlotByDay.get(date) ?? null,
                status: r.status,
                source: r.source,
                scannedAt: r.scannedAt,
                note: r.note,
            };
        }),
    };
};

interface SessionRef {
    groupId: string;
    date: string; // YYYY-MM-DD
    slotStart: string; // HH:MM, must be one of the group's sessions that day
    branchId: string;
}

interface MarkAttendanceInput extends SessionRef {
    studentId: string;
    status: string;
    note?: string | null;
    userId?: string;
}

interface MarkSessionInput extends SessionRef {
    entries: { studentId: string; status: string; note?: string | null }[];
    userId?: string;
}

const assertStatus = (status: string): MarkableStatus => {
    if (!(MARKABLE_STATUSES as readonly string[]).includes(status)) {
        throw new Error(`Status must be one of ${MARKABLE_STATUSES.join(', ')}`);
    }
    return status as MarkableStatus;
};

/** Checks that the session exists for this group, on a working day, and loads what saving needs. */
const loadSession = async ({ groupId, slotStart, branchId, ...ref }: SessionRef) => {
    const date = parseDateKey(ref.date);
    if (!date) {
        throw new Error('Invalid date (expected YYYY-MM-DD)');
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group || group.branchId !== branchId) {
        throw new Error('Group not found');
    }

    const daySlots = slotsOnDate((group.timeSlots as unknown as TimeSlot[]) || [], date);
    const slot = daySlots.find((s) => s.startTime === slotStart);
    if (!slot) {
        throw new Error('This group has no session at this time on that day');
    }

    const holidays = await prisma.holiday.findMany({
        where: {
            branchId,
            active: true,
            startDate: { lt: new Date(date.getTime() + 2 * DAY_MS) },
            endDate: { gte: new Date(date.getTime() - DAY_MS) },
        },
    });
    if (holidayOn(holidays, date)) {
        throw new Error('This day is a holiday');
    }

    return { group, date, slot, firstSlotStart: daySlots[0]?.startTime, started: parseTimeOnDate(date, slot.startTime) <= new Date() };
};

const saveSessionRecord = async (
    session: Awaited<ReturnType<typeof loadSession>>,
    entry: { studentId: string; status: MarkableStatus; note?: string | null },
    branchId: string,
    userId?: string
) => {
    const { group, date, slot } = session;
    const dayRecords = await prisma.attendance.findMany({
        where: { studentId: entry.studentId, groupId: group.id, date },
    });
    const existing = findSessionRecord(dayRecords, slot.startTime, session.firstSlotStart);

    const data = {
        status: entry.status,
        note: entry.note?.trim() || null,
        source: 'MANUAL' as const,
        markedById: userId || null,
        slotStart: slot.startTime,
    };

    if (existing) {
        return prisma.attendance.update({ where: { id: (existing as any).id }, data });
    }

    try {
        return await prisma.attendance.create({
            data: { ...data, studentId: entry.studentId, groupId: group.id, branchId, date },
        });
    } catch (error) {
        if ((error as any)?.code === 'P2002') {
            throw new Error('This session was just updated by someone else, reload and try again');
        }
        throw error;
    }
};

// An excuse can be recorded ahead of time (a known appointment); presence cannot.
const assertCanMark = (status: MarkableStatus, started: boolean) => {
    if (status !== 'JUSTIFIED' && !started) {
        throw new Error('This session has not started yet');
    }
};

/** Sets (creates or corrects) one student's status for one session — one cell of the grid. */
export const markAttendance = async (input: MarkAttendanceInput) => {
    const status = assertStatus(input.status);
    const session = await loadSession(input);

    const student = await prisma.student.findUnique({ where: { id: input.studentId } });
    if (!student || student.branchId !== input.branchId) {
        throw new Error('Student not found');
    }
    if (!session.group.studentIds.includes(input.studentId)) {
        throw new Error('Student is not enrolled in this group');
    }
    assertCanMark(status, session.started);

    return saveSessionRecord(session, { studentId: input.studentId, status, note: input.note }, input.branchId, input.userId);
};

/** Takes the roll of a whole session at once. All-or-nothing validation before any write. */
export const markSession = async (input: MarkSessionInput) => {
    if (!Array.isArray(input.entries) || input.entries.length === 0) {
        throw new Error('entries must be a non-empty list');
    }

    const entries = input.entries.map((e) => ({ studentId: e.studentId, status: assertStatus(e.status), note: e.note }));
    const session = await loadSession(input);

    const ids = new Set<string>();
    for (const entry of entries) {
        if (!entry.studentId || ids.has(entry.studentId)) {
            throw new Error('Each student must appear once');
        }
        ids.add(entry.studentId);
        // Group membership already implies the branch: groups only hold their branch's students.
        if (!session.group.studentIds.includes(entry.studentId)) {
            throw new Error('Student is not enrolled in this group');
        }
        assertCanMark(entry.status, session.started);
    }

    const saved = [];
    for (const entry of entries) {
        saved.push(await saveSessionRecord(session, entry, input.branchId, input.userId));
    }
    return saved;
};
