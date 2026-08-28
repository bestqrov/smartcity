export interface TimeSlot {
    day: string;
    startTime: string;
    endTime: string;
}

const GRACE_PERIOD_MINUTES = 5;
export const WEEKDAY_NAMES = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export const parseTimeOnDate = (date: Date, hhmm: string): Date => {
    const [hours, minutes] = hhmm.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
};

export const deriveAttendanceStatus = (
    timeSlots: TimeSlot[],
    scannedAt: Date
): 'PRESENT' | 'LATE' => {
    const dayName = WEEKDAY_NAMES[scannedAt.getDay()];
    const todaySlots = timeSlots.filter((slot) => slot.day === dayName);

    if (todaySlots.length === 0) {
        throw new Error('No scheduled session for this group today');
    }

    let slotStart = parseTimeOnDate(scannedAt, todaySlots[0].startTime);
    let closestDiff = Math.abs(scannedAt.getTime() - slotStart.getTime());

    for (let i = 1; i < todaySlots.length; i += 1) {
        const candidateStart = parseTimeOnDate(scannedAt, todaySlots[i].startTime);
        const diff = Math.abs(scannedAt.getTime() - candidateStart.getTime());
        if (diff < closestDiff) {
            closestDiff = diff;
            slotStart = candidateStart;
        }
    }

    const graceDeadline = new Date(slotStart.getTime() + GRACE_PERIOD_MINUTES * 60_000);

    return scannedAt.getTime() <= graceDeadline.getTime() ? 'PRESENT' : 'LATE';
};
