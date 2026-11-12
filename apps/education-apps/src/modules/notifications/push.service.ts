import prisma from '../../config/database';
import { hashToken } from '../../utils/accessToken';
import { isAllowedPushEndpoint } from './push.sender';

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
    if (!isStr(endpoint) || !isAllowedPushEndpoint(endpoint) || !isStr(p256dh, 500) || !isStr(auth, 500)) {
        throw new Error('Invalid subscription');
    }
    const language = lang === 'ar' ? 'ar' : 'fr';
    // An endpoint is a device: it cannot be moved from one parent to another.
    const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    if (existing && existing.parentId !== parent.id) throw new Error('Invalid subscription');
    await prisma.pushSubscription.upsert({
        where: { endpoint },
        create: { endpoint, p256dh, auth, lang: language, parentId: parent.id, branchId: parent.branchId },
        update: { p256dh, auth, lang: language },
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
