// Parent-facing attendance messages. Sent in French and Arabic together because the
// centers' families read either one.

const hhmm = (date: Date): string =>
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

export const arrivedMessage = (studentName: string, groupName: string, at: Date): string =>
    `${studentName} est arrivé(e) au cours « ${groupName} » à ${hhmm(at)}.\n` +
    `وصل(ت) ${studentName} إلى حصة « ${groupName} » على الساعة ${hhmm(at)}.`;

export const lateMessage = (studentName: string, groupName: string, at: Date): string =>
    `${studentName} est arrivé(e) en retard au cours « ${groupName} » à ${hhmm(at)}.\n` +
    `وصل(ت) ${studentName} متأخراً إلى حصة « ${groupName} » على الساعة ${hhmm(at)}.`;

export const absentMessage = (
    studentName: string,
    groupName: string,
    startTime: string,
    endTime: string
): string =>
    `${studentName} était absent(e) aujourd'hui au cours « ${groupName} » (${startTime} - ${endTime}).\n` +
    `${studentName} كان(ت) غائباً اليوم عن حصة « ${groupName} » (${startTime} - ${endTime}).`;
