import prisma from '../../config/database';
import { whatsappNumber } from './phone';

export type NotificationKind = 'ATTENDANCE' | 'GRADE' | 'ANNOUNCEMENT' | 'ACTIVITY' | 'HOMEWORK';

/** French and Arabic text; push picks one by the subscription's lang, WhatsApp sends both. */
export interface Localized {
    fr: string;
    ar: string;
}

export interface NotifyInput {
    kind: NotificationKind;
    branchId: string;
    title: Localized;
    body: Localized;
    /** Deep link for the push click; omitted = the installed app's start_url. */
    path?: string | null;
}

/** "fr line\nar line" (the attendance messages) → { fr, ar }. */
export const splitBilingual = (text: string): Localized => {
    const idx = text.indexOf('\n');
    if (idx < 0) return { fr: text, ar: text };
    return { fr: text.slice(0, idx), ar: text.slice(idx + 1) };
};

const pick = (l: Localized, lang: string) => (lang === 'ar' ? l.ar : l.fr);

const whatsappText = (title: Localized, body: Localized) => {
    const fr = `*${title.fr}*\n${body.fr}`;
    if (title.ar === title.fr && body.ar === body.fr) return fr;
    return `${fr}\n\n*${title.ar}*\n${body.ar}`;
};

const KIND_TOGGLE: Record<NotificationKind, 'sendAttendance' | 'sendGrades' | 'sendAnnouncements' | 'sendActivities' | 'sendHomework'> = {
    ATTENDANCE: 'sendAttendance',
    GRADE: 'sendGrades',
    ANNOUNCEMENT: 'sendAnnouncements',
    ACTIVITY: 'sendActivities',
    HOMEWORK: 'sendHomework',
};

/** Outbox order: lower is sent first (the worker sorts by priority, then sendAfter). */
export const KIND_PRIORITY: Record<string, number> = {
    ATTENDANCE: 1,
    GRADE: 3,
    HOMEWORK: 3,
    ACTIVITY: 4,
    ANNOUNCEMENT: 5,
};

/**
 * Queues one PUSH message per subscription of each parent, plus one WHATSAPP message per parent
 * when the branch's channel is CONNECTED and this kind is enabled. Nothing is sent here: the
 * outbox worker does that. Returns the number of queued messages.
 */
export const notify = async (parentIds: string[], input: NotifyInput): Promise<number> => {
    const ids = [...new Set(parentIds.filter(Boolean))];
    if (ids.length === 0) return 0;

    const [parents, subscriptions, channel] = await Promise.all([
        prisma.parent.findMany({ where: { id: { in: ids } }, select: { id: true, phone: true, whatsapp: true } }),
        prisma.pushSubscription.findMany({ where: { parentId: { in: ids } } }),
        prisma.whatsappChannel.findUnique({ where: { branchId: input.branchId } }),
    ]);

    const whatsappOn = !!channel && channel.status === 'CONNECTED' && channel[KIND_TOGGLE[input.kind]] === true;
    const url = input.path ?? null;
    const priority = KIND_PRIORITY[input.kind] ?? 5;
    const data: any[] = [];

    for (const parent of parents) {
        for (const sub of subscriptions.filter((s: any) => s.parentId === parent.id)) {
            data.push({
                branchId: input.branchId,
                parentId: parent.id,
                channel: 'PUSH',
                kind: input.kind,
                to: sub.endpoint,
                title: pick(input.title, sub.lang),
                body: pick(input.body, sub.lang),
                url,
                priority,
            });
        }
        if (whatsappOn) {
            const to = whatsappNumber(parent.whatsapp || parent.phone);
            if (to) {
                data.push({
                    branchId: input.branchId,
                    parentId: parent.id,
                    channel: 'WHATSAPP',
                    kind: input.kind,
                    to,
                    title: input.title.fr,
                    body: whatsappText(input.title, input.body),
                    url,
                    priority,
                });
            }
        }
    }

    if (data.length === 0) return 0;
    await prisma.outboundMessage.createMany({ data });
    return data.length;
};

/** Fire-and-forget wrapper for triggers: a notification failure never breaks the action. */
export const notifySafely = (parentIds: string[], input: NotifyInput): Promise<void> =>
    notify(parentIds, input).then(
        () => undefined,
        (error) => console.error(`[notify] failed to queue ${input.kind}:`, error)
    );

export const ATTENDANCE_TITLE: Localized = { fr: 'Présence', ar: 'الحضور' };
