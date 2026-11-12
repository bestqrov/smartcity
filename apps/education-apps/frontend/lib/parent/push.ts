import api from '../api';
import type { ParentLang } from './messages';

export const isPushSupported = (): boolean =>
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const isStandalone = (): boolean =>
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

export const isIOS = (): boolean =>
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const scopeFor = (token: string) => `/p/${encodeURIComponent(token)}`;

function urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}

let keyPromise: Promise<string | null> | null = null;
export function getPublicKey(): Promise<string | null> {
    if (!keyPromise) {
        keyPromise = api
            .get<{ data: { publicKey: string | null } }>('/push/public-key')
            .then((r) => r.data.data?.publicKey ?? null)
            .catch(() => {
                keyPromise = null;
                return null;
            });
    }
    return keyPromise;
}

export async function registerWorker(token: string): Promise<ServiceWorkerRegistration> {
    await navigator.serviceWorker.register('/sw.js', { scope: scopeFor(token) });
    // `ready` only resolves for the page's controlling scope, so look the registration up directly.
    const reg = await navigator.serviceWorker.getRegistration(scopeFor(token));
    if (!reg) throw new Error('Service worker not registered');
    if (!reg.active) {
        await new Promise<void>((resolve) => {
            const sw = reg.installing || reg.waiting;
            if (!sw) return resolve();
            sw.addEventListener('statechange', () => sw.state === 'activated' && resolve());
        });
    }
    return reg;
}

export async function getSubscription(token: string): Promise<PushSubscription | null> {
    if (!isPushSupported()) return null;
    const reg = await navigator.serviceWorker.getRegistration(scopeFor(token));
    return reg ? reg.pushManager.getSubscription() : null;
}

/** Returns true when subscribed; false when permission was refused or push isn't available. */
export async function subscribe(token: string, lang: ParentLang): Promise<boolean> {
    if (!isPushSupported()) return false;
    const publicKey = await getPublicKey();
    if (!publicKey) return false;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
    const reg = await registerWorker(token);
    const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));
    const json = sub.toJSON();
    await api.post(`/push/subscribe/${encodeURIComponent(token)}`, {
        subscription: { endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth } },
        lang,
    });
    return true;
}

export async function unsubscribe(token: string): Promise<void> {
    const sub = await getSubscription(token);
    if (!sub) return;
    await api.delete(`/push/subscribe/${encodeURIComponent(token)}`, { data: { endpoint: sub.endpoint } }).catch(() => undefined);
    await sub.unsubscribe();
}
