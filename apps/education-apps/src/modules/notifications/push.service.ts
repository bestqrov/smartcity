import prisma from '../../config/database';
import { hashToken } from '../../utils/accessToken';

export interface SubscriptionInput {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
}

const isStr = (v: unknown, max = 2000): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

const parentByToken = async (rawToken: string) => {
    if (!isStr(rawToken, 200)) return null;
    return prisma.parent.findUnique({
        where: { accessTokenHash: hashToken(rawToken) },
        select: { id: true, branchId: true },
    });
};

export const subscribe = async (rawToken: string, subscription: SubscriptionInput | undefined, lang: unknown) => {
    const parent = await parentByToken(rawToken);
    if (!parent) throw new Error('Parent not found');
    if (!parent.branchId) throw new Error('Parent has no branch');
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    if (!isStr(endpoint) || !/^https:\/\//.test(endpoint) || !isStr(p256dh, 500) || !isStr(auth, 500)) {
        throw new Error('Invalid subscription');
    }
    const language = lang === 'ar' ? 'ar' : 'fr';
    await prisma.pushSubscription.upsert({
        where: { endpoint },
        create: { endpoint, p256dh, auth, lang: language, parentId: parent.id, branchId: parent.branchId },
        update: { p256dh, auth, lang: language, parentId: parent.id, branchId: parent.branchId },
    });
    return { subscribed: true };
};

export const unsubscribe = async (rawToken: string, endpoint: unknown) => {
    const parent = await parentByToken(rawToken);
    if (!parent) throw new Error('Parent not found');
    if (!isStr(endpoint)) throw new Error('endpoint is required');
    await prisma.pushSubscription.deleteMany({ where: { endpoint, parentId: parent.id } });
    return { subscribed: false };
};
