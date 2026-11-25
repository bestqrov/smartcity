import prisma from '../../config/database';
import * as evolution from './evolution.client';

export const PLATFORM_INSTANCE = 'arwa-platform';
const KEY = 'default';

const publicChannel = (configured: boolean, channel: any) => ({
    configured,
    status: channel?.status ?? 'DISCONNECTED',
    phone: channel?.phone ?? null,
});

const ensure = () =>
    prisma.platformWhatsapp.upsert({ where: { key: KEY }, create: { key: KEY, instance: PLATFORM_INSTANCE }, update: {} });

const toStatus = (state: evolution.EvolutionState) =>
    state === 'open' ? 'CONNECTED' : state === 'connecting' ? 'CONNECTING' : 'DISCONNECTED';

/** True when the platform number can send (used by the broadcast page and worker). */
export const isPlatformWhatsappConnected = async (): Promise<boolean> => {
    if (!evolution.isEvolutionConfigured()) return false;
    const channel = await prisma.platformWhatsapp.findUnique({ where: { key: KEY } });
    return channel?.status === 'CONNECTED';
};

export const getPlatformWhatsappStatus = async () => {
    const configured = evolution.isEvolutionConfigured();
    let channel = await prisma.platformWhatsapp.findUnique({ where: { key: KEY } });
    if (configured && channel && (channel.status === 'CONNECTING' || channel.status === 'CONNECTED')) {
        try {
            const status = toStatus(await evolution.connectionState(PLATFORM_INSTANCE));
            let phone = channel.phone;
            if (status === 'CONNECTED' && !phone) phone = await evolution.fetchOwnerPhone(PLATFORM_INSTANCE);
            if (status === 'DISCONNECTED') phone = null;
            if (status !== channel.status || phone !== channel.phone) {
                channel = await prisma.platformWhatsapp.update({ where: { key: KEY }, data: { status, phone } });
            }
        } catch (error) {
            console.error('[platform-whatsapp] status refresh failed:', (error as Error).message);
        }
    }
    return publicChannel(configured, channel);
};

export const connectPlatformWhatsapp = async () => {
    if (!evolution.isEvolutionConfigured()) throw new Error('WhatsApp automatique non disponible');
    const channel = await ensure();
    let state: evolution.EvolutionState = 'unknown';
    try {
        state = await evolution.connectionState(PLATFORM_INSTANCE);
    } catch (error: any) {
        if (error?.status !== 404) throw error;
    }
    if (state === 'open') {
        const phone = (await evolution.fetchOwnerPhone(PLATFORM_INSTANCE)) ?? channel.phone ?? null;
        const updated = await prisma.platformWhatsapp.update({ where: { key: KEY }, data: { status: 'CONNECTED', phone } });
        return { ...publicChannel(true, updated), qr: { base64: null, code: null } };
    }
    let qr: { base64?: string; code?: string } = {};
    try {
        qr = await evolution.connectInstance(PLATFORM_INSTANCE);
    } catch (error: any) {
        if (error?.status !== 404) throw error;
        qr = await evolution.createInstance(PLATFORM_INSTANCE);
        if (!qr.base64 && !qr.code) qr = await evolution.connectInstance(PLATFORM_INSTANCE);
    }
    const updated = await prisma.platformWhatsapp.update({ where: { key: KEY }, data: { status: 'CONNECTING', phone: null } });
    return { ...publicChannel(true, updated), qr: { base64: qr.base64 ?? null, code: qr.code ?? null } };
};

export const disconnectPlatformWhatsapp = async () => {
    const channel = await prisma.platformWhatsapp.findUnique({ where: { key: KEY } });
    if (!channel) return publicChannel(evolution.isEvolutionConfigured(), null);
    if (evolution.isEvolutionConfigured()) {
        try {
            await evolution.logoutInstance(PLATFORM_INSTANCE);
        } catch (error) {
            console.error('[platform-whatsapp] logout failed:', (error as Error).message);
        }
    }
    const updated = await prisma.platformWhatsapp.update({ where: { key: KEY }, data: { status: 'DISCONNECTED', phone: null } });
    return publicChannel(evolution.isEvolutionConfigured(), updated);
};
