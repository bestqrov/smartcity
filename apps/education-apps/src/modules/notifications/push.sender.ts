import webpush from 'web-push';

export const isPushConfigured = (): boolean =>
    !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;

export const vapidPublicKey = (): string | null => process.env.VAPID_PUBLIC_KEY || null;

export interface PushTarget {
    endpoint: string;
    p256dh: string;
    auth: string;
}

/** Throws the web-push error as-is so the worker can read `statusCode` (404/410 = expired). */
export const sendPush = async (target: PushTarget, payload: { title: string; body: string; url?: string | null }) => {
    if (!isPushConfigured()) throw new Error('Push (VAPID) is not configured');
    await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
        {
            TTL: 24 * 60 * 60,
            vapidDetails: {
                subject: process.env.VAPID_SUBJECT || 'mailto:contact@example.com',
                publicKey: process.env.VAPID_PUBLIC_KEY!,
                privateKey: process.env.VAPID_PRIVATE_KEY!,
            },
        }
    );
};

const PUSH_HOSTS = new Set(['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com']);
const PUSH_HOST_SUFFIXES = ['.push.apple.com', '.notify.windows.com'];

/** SSRF guard: only real browser push services, over https on the default port. */
export const isAllowedPushEndpoint = (endpoint: unknown): boolean => {
    if (typeof endpoint !== 'string') return false;
    let url: URL;
    try {
        url = new URL(endpoint);
    } catch {
        return false;
    }
    if (url.protocol !== 'https:') return false;
    if (url.port !== '' && url.port !== '443') return false;
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    return PUSH_HOSTS.has(host) || PUSH_HOST_SUFFIXES.some((s) => host.endsWith(s));
};
