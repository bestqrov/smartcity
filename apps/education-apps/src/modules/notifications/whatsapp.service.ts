import prisma from '../../config/database';
import * as evolution from './evolution.client';
import { whatsappNumber } from './phone';

const publicChannel = (configured: boolean, channel: any) => ({
    configured,
    status: channel?.status ?? 'DISCONNECTED',
    phone: channel?.phone ?? null,
    sendAttendance: channel?.sendAttendance ?? true,
    sendGrades: channel?.sendGrades ?? true,
    sendAnnouncements: channel?.sendAnnouncements ?? false,
});

const ensureChannel = (branchId: string) =>
    prisma.whatsappChannel.upsert({
        where: { branchId },
        create: { branchId, instance: evolution.instanceName(branchId) },
        update: {},
    });

const toStatus = (state: evolution.EvolutionState) =>
    state === 'open' ? 'CONNECTED' : state === 'connecting' ? 'CONNECTING' : 'DISCONNECTED';

export const getStatus = async (branchId: string) => {
    const configured = evolution.isEvolutionConfigured();
    let channel = await prisma.whatsappChannel.findUnique({ where: { branchId } });
    if (configured && channel && (channel.status === 'CONNECTING' || channel.status === 'CONNECTED')) {
        try {
            const status = toStatus(await evolution.connectionState(channel.instance));
            let phone = channel.phone;
            if (status === 'CONNECTED' && !phone) phone = await evolution.fetchOwnerPhone(channel.instance);
            if (status === 'DISCONNECTED') phone = null;
            if (status !== channel.status || phone !== channel.phone) {
                channel = await prisma.whatsappChannel.update({ where: { branchId }, data: { status, phone } });
            }
        } catch (error) {
            console.error('[whatsapp] status refresh failed:', (error as Error).message);
        }
    }
    return publicChannel(configured, channel);
};

export const connect = async (branchId: string) => {
    if (!evolution.isEvolutionConfigured()) throw new Error('WhatsApp automatique non disponible');
    const channel = await ensureChannel(branchId);
    let qr: { base64?: string; code?: string } = {};
    try {
        qr = await evolution.connectInstance(channel.instance);
    } catch {
        // Instance missing on the Evolution server: create it (the create response carries the QR).
        qr = await evolution.createInstance(channel.instance);
        if (!qr.base64 && !qr.code) qr = await evolution.connectInstance(channel.instance);
    }
    const updated = await prisma.whatsappChannel.update({ where: { branchId }, data: { status: 'CONNECTING', phone: null } });
    return { ...publicChannel(true, updated), qr: { base64: qr.base64 ?? null, code: qr.code ?? null } };
};

export const updateSettings = async (branchId: string, input: Record<string, unknown>) => {
    const data: Record<string, boolean> = {};
    for (const key of ['sendAttendance', 'sendGrades', 'sendAnnouncements']) {
        if (input[key] === undefined) continue;
        if (typeof input[key] !== 'boolean') throw new Error(`${key} must be a boolean`);
        data[key] = input[key] as boolean;
    }
    await ensureChannel(branchId);
    const channel = await prisma.whatsappChannel.update({ where: { branchId }, data });
    return publicChannel(evolution.isEvolutionConfigured(), channel);
};

export const sendTest = async (branchId: string, phone: unknown) => {
    if (!evolution.isEvolutionConfigured()) throw new Error('WhatsApp automatique non disponible');
    const number = whatsappNumber(typeof phone === 'string' ? phone : '');
    if (!number || number.length < 8 || number.length > 15) throw new Error('Invalid phone number');
    const channel = await prisma.whatsappChannel.findUnique({ where: { branchId } });
    if (!channel || channel.status !== 'CONNECTED') throw new Error('WhatsApp is not connected');
    await evolution.sendText(
        channel.instance,
        number,
        'Message test ArwaEduc : WhatsApp automatique est bien connecté.\nرسالة تجريبية: واتساب الأوتوماتيكي مفعّل.'
    );
    return { sent: true, to: number };
};

export const disconnect = async (branchId: string) => {
    const channel = await prisma.whatsappChannel.findUnique({ where: { branchId } });
    if (!channel) return publicChannel(evolution.isEvolutionConfigured(), null);
    if (evolution.isEvolutionConfigured()) {
        try {
            await evolution.logoutInstance(channel.instance);
        } catch (error) {
            console.error('[whatsapp] logout failed:', (error as Error).message);
        }
    }
    const updated = await prisma.whatsappChannel.update({ where: { branchId }, data: { status: 'DISCONNECTED', phone: null } });
    return publicChannel(evolution.isEvolutionConfigured(), updated);
};

export const recentMessages = async (branchId: string) => {
    const rows = await prisma.outboundMessage.findMany({
        where: { branchId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
            id: true, channel: true, kind: true, to: true, title: true, body: true, status: true,
            error: true, attempts: true, createdAt: true, sentAt: true, parentId: true,
        },
    });
    // A push "to" is the device endpoint: internal, not shown.
    return rows.map((r: any) => ({ ...r, to: r.channel === 'PUSH' ? null : r.to }));
};
