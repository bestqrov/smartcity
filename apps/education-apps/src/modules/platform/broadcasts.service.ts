import prisma from '../../config/database';
import { whatsappNumber } from '../notifications/phone';
import { isMailConfigured } from '../notifications/mailer';
import { isPlatformWhatsappConnected } from '../notifications/platformWhatsapp.service';

export const SCHOOL_STATES = ['TRIAL', 'TRIAL_EXPIRED', 'ACTIVE', 'SUSPENDED'] as const;
export type SchoolState = (typeof SCHOOL_STATES)[number];
export const CHANNELS = ['EMAIL', 'WHATSAPP'] as const;
export type Channel = (typeof CHANNELS)[number];
const INSTITUTION_TYPES = ['PRIVATE_SCHOOL', 'TUTORING_CENTER', 'VOCATIONAL_TRAINING', 'LANGUAGE_CENTER', 'CRECHE'];

export const OPT_OUT_LINE = 'Pour ne plus recevoir ces messages, répondez STOP';
const OBJECT_ID = /^[a-f0-9]{24}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface BroadcastFilters {
    states?: SchoolState[];
    packId?: string;
    institutionType?: string;
    salesAgentId?: string;
}

interface SchoolRow {
    id: string;
    name: string;
    status: string;
    trialEndsAt: Date | null;
    institutionType: string | null;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string | null;
    email: string | null;
    phone: string | null;
}

/** Trial running = PENDING with no end date or an end date still ahead (same rule as tenantScope). */
export const schoolState = (school: { status: string; trialEndsAt: Date | null }, now: Date): SchoolState => {
    if (school.status === 'ACTIVE') return 'ACTIVE';
    if (school.status === 'SUSPENDED') return 'SUSPENDED';
    return school.trialEndsAt && now > new Date(school.trialEndsAt) ? 'TRIAL_EXPIRED' : 'TRIAL';
};

export const validateFilters = (input: unknown): BroadcastFilters => {
    const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const filters: BroadcastFilters = {};
    if (raw.states !== undefined && raw.states !== null) {
        if (!Array.isArray(raw.states) || !raw.states.every((s) => (SCHOOL_STATES as readonly unknown[]).includes(s))) {
            throw new Error('states must be a list of TRIAL, TRIAL_EXPIRED, ACTIVE, SUSPENDED');
        }
        if (raw.states.length) filters.states = SCHOOL_STATES.filter((s) => (raw.states as unknown[]).includes(s));
    }
    for (const key of ['packId', 'salesAgentId'] as const) {
        const v = raw[key];
        if (v === undefined || v === null || v === '') continue;
        if (typeof v !== 'string' || !OBJECT_ID.test(v)) throw new Error(`${key} is invalid`);
        filters[key] = v;
    }
    if (raw.institutionType !== undefined && raw.institutionType !== null && raw.institutionType !== '') {
        if (typeof raw.institutionType !== 'string' || !INSTITUTION_TYPES.includes(raw.institutionType)) {
            throw new Error('institutionType is invalid');
        }
        filters.institutionType = raw.institutionType;
    }
    return filters;
};

export const findRecipients = async (filters: BroadcastFilters, now: Date = new Date()): Promise<SchoolRow[]> => {
    const where: Record<string, unknown> = {};
    if (filters.packId) where.packId = filters.packId;
    if (filters.salesAgentId) where.salesAgentId = filters.salesAgentId;
    const schools: SchoolRow[] = await prisma.school.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        select: {
            id: true, name: true, status: true, trialEndsAt: true, institutionType: true,
            ownerName: true, ownerEmail: true, ownerPhone: true, email: true, phone: true,
        },
    });
    return schools.filter((s) => {
        if (filters.institutionType && (s.institutionType ?? 'PRIVATE_SCHOOL') !== filters.institutionType) return false;
        if (filters.states && !filters.states.includes(schoolState(s, now))) return false;
        return true;
    });
};

export const fillPlaceholders = (text: string, school: { name: string; ownerName: string }) =>
    text.replace(/\{ecole\}/g, school.name || '').replace(/\{proprietaire\}/g, school.ownerName || '');

export const emailOf = (s: SchoolRow): string | null => {
    for (const v of [s.ownerEmail, s.email]) if (v && EMAIL_RE.test(v.trim())) return v.trim().toLowerCase();
    return null;
};

export const phoneOf = (s: SchoolRow): string | null => {
    for (const v of [s.ownerPhone, s.phone]) {
        const n = whatsappNumber(v);
        if (n && n.length >= 8 && n.length <= 15) return n;
    }
    return null;
};

export const emailBody = (body: string) => `${body}\n\n--\n${OPT_OUT_LINE}`;
export const whatsappBody = (subject: string, body: string) => (subject ? `*${subject}*\n\n${body}` : body);

const validateChannels = (input: unknown): Channel[] => {
    if (!Array.isArray(input) || input.length === 0 || !input.every((c) => (CHANNELS as readonly unknown[]).includes(c))) {
        throw new Error('channels must be a non-empty list of EMAIL, WHATSAPP');
    }
    return CHANNELS.filter((c) => input.includes(c));
};

export const channelAvailability = async () => ({
    email: isMailConfigured(),
    whatsapp: await isPlatformWhatsappConnected(),
});

export const previewBroadcast = async (input: Record<string, unknown>) => {
    const filters = validateFilters(input?.filters);
    const schools = await findRecipients(filters);
    return {
        schools: schools.length,
        email: schools.filter((s) => emailOf(s)).length,
        whatsapp: schools.filter((s) => phoneOf(s)).length,
        channels: await channelAvailability(),
    };
};

export const createBroadcast = async (input: Record<string, unknown>, userId: string | null) => {
    const subject = typeof input?.subject === 'string' ? input.subject.trim() : '';
    const body = typeof input?.body === 'string' ? input.body.trim() : '';
    if (!subject || subject.length > 150) throw new Error('subject is required (150 characters max)');
    if (!body || body.length > 4000) throw new Error('body is required (4000 characters max)');
    const channels = validateChannels(input?.channels);
    const filters = validateFilters(input?.filters);

    const available = await channelAvailability();
    if (channels.includes('EMAIL') && !available.email) throw new Error('Email (SMTP) is not configured');
    if (channels.includes('WHATSAPP') && !available.whatsapp) throw new Error('Platform WhatsApp is not connected');

    const schools = await findRecipients(filters);
    if (!schools.length) throw new Error('No school matches these filters');

    const broadcast = await prisma.broadcast.create({
        data: { subject, body, channels, filters: filters as object, total: schools.length, createdBy: userId },
    });
    const rows: any[] = [];
    for (const school of schools) {
        const text = fillPlaceholders(body, school);
        const subj = fillPlaceholders(subject, school);
        if (channels.includes('EMAIL')) {
            const to = emailOf(school);
            rows.push({
                broadcastId: broadcast.id, schoolId: school.id, schoolName: school.name, channel: 'EMAIL', to,
                subject: subj, body: emailBody(text),
                ...(to ? {} : { status: 'SKIPPED', error: 'Aucun email' }),
            });
        }
        if (channels.includes('WHATSAPP')) {
            const to = phoneOf(school);
            rows.push({
                broadcastId: broadcast.id, schoolId: school.id, schoolName: school.name, channel: 'WHATSAPP', to,
                subject: subj, body: whatsappBody(subj, text),
                ...(to ? {} : { status: 'SKIPPED', error: 'Aucun numéro de téléphone' }),
            });
        }
    }
    await prisma.broadcastMessage.createMany({ data: rows });
    return refreshBroadcastCounts(broadcast.id);
};

/** Recomputes the per-channel counts of a broadcast from its messages. */
export const refreshBroadcastCounts = async (broadcastId: string) => {
    const groups: Array<{ channel: string; status: string; _count: { _all: number } }> = await (prisma.broadcastMessage.groupBy as any)({
        by: ['channel', 'status'],
        where: { broadcastId },
        _count: { _all: true },
    });
    const n = (channel: string, status: string) =>
        groups.filter((g) => g.channel === channel && g.status === status).reduce((a, g) => a + g._count._all, 0);
    return prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
            emailSent: n('EMAIL', 'SENT'), emailFailed: n('EMAIL', 'FAILED'), emailSkipped: n('EMAIL', 'SKIPPED'),
            whatsappSent: n('WHATSAPP', 'SENT'), whatsappFailed: n('WHATSAPP', 'FAILED'), whatsappSkipped: n('WHATSAPP', 'SKIPPED'),
        },
    });
};

export const listBroadcasts = () =>
    prisma.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });

export const getBroadcast = async (id: string) => {
    if (!OBJECT_ID.test(id)) throw new Error('Broadcast not found');
    const broadcast = await prisma.broadcast.findUnique({ where: { id } });
    if (!broadcast) throw new Error('Broadcast not found');
    const messages = await prisma.broadcastMessage.findMany({
        where: { broadcastId: id },
        orderBy: [{ schoolName: 'asc' }, { channel: 'asc' }],
        select: { id: true, schoolId: true, schoolName: true, channel: true, to: true, status: true, error: true, attempts: true, sentAt: true },
    });
    return { ...broadcast, messages };
};

/** Requeues the FAILED messages of a broadcast with fresh attempts. */
export const retryBroadcast = async (id: string) => {
    if (!OBJECT_ID.test(id)) throw new Error('Broadcast not found');
    const broadcast = await prisma.broadcast.findUnique({ where: { id } });
    if (!broadcast) throw new Error('Broadcast not found');
    const { count } = await prisma.broadcastMessage.updateMany({
        where: { broadcastId: id, status: 'FAILED' },
        data: { status: 'PENDING', attempts: 0, error: null, sendAfter: new Date(), lockedAt: null },
    });
    const updated = await refreshBroadcastCounts(id);
    return { requeued: count, broadcast: updated };
};
