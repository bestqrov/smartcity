/**
 * Thin wrapper over the Evolution API (v2). URL and global key come from the env, read lazily,
 * and are never returned to a client.
 */
const TIMEOUT_MS = 15_000;

export type EvolutionState = 'open' | 'connecting' | 'close' | 'unknown';

const config = () => ({
    url: (process.env.EVOLUTION_API_URL || '').replace(/\/+$/, ''),
    key: process.env.EVOLUTION_API_KEY || '',
});

export const isEvolutionConfigured = (): boolean => {
    const { url, key } = config();
    return !!url && !!key;
};

export const instanceName = (branchId: string) => `arwa-${branchId}`;

/** HTTP error from Evolution; `status` lets callers tell "instance missing" (404) from other failures. */
export class EvolutionError extends Error {
    constructor(message: string, public readonly status: number) {
        super(message);
        this.name = 'EvolutionError';
    }
}

const call = async (method: string, path: string, body?: unknown): Promise<any> => {
    const { url, key } = config();
    if (!url || !key) throw new Error('WhatsApp (Evolution API) is not configured');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${url}${path}`, {
            method,
            headers: { apikey: key, 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
        });
        const text = await res.text();
        let data: any = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }
        if (!res.ok) {
            const detail = data && typeof data === 'object' ? JSON.stringify(data.response ?? data.message ?? data).slice(0, 300) : '';
            throw new EvolutionError(`Evolution API ${res.status}${detail ? `: ${detail}` : ''}`, res.status);
        }
        return data;
    } catch (error: any) {
        if (error?.name === 'AbortError') throw new Error('Evolution API timeout');
        throw error;
    } finally {
        clearTimeout(timer);
    }
};

export const createInstance = async (instance: string): Promise<{ base64?: string; code?: string }> => {
    const data = await call('POST', '/instance/create', { instanceName: instance, integration: 'WHATSAPP-BAILEYS', qrcode: true });
    const qr = data?.qrcode ?? {};
    return {
        base64: typeof qr.base64 === 'string' ? qr.base64 : undefined,
        code: typeof qr.code === 'string' ? qr.code : undefined,
    };
};

export const connectInstance = async (instance: string): Promise<{ base64?: string; code?: string }> => {
    const data = await call('GET', `/instance/connect/${encodeURIComponent(instance)}`);
    return {
        base64: typeof data?.base64 === 'string' ? data.base64 : undefined,
        code: typeof data?.code === 'string' ? data.code : undefined,
    };
};

export const connectionState = async (instance: string): Promise<EvolutionState> => {
    const data = await call('GET', `/instance/connectionState/${encodeURIComponent(instance)}`);
    const state = data?.instance?.state ?? data?.state;
    return state === 'open' || state === 'connecting' || state === 'close' ? state : 'unknown';
};

export const sendText = async (instance: string, number: string, text: string): Promise<void> => {
    await call('POST', `/message/sendText/${encodeURIComponent(instance)}`, { number, text });
};

export const logoutInstance = async (instance: string): Promise<void> => {
    await call('DELETE', `/instance/logout/${encodeURIComponent(instance)}`);
};

/** Owner number of a connected instance, best effort (for display only). */
export const fetchOwnerPhone = async (instance: string): Promise<string | null> => {
    try {
        const data = await call('GET', `/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`);
        const row = Array.isArray(data) ? data[0] : data;
        const owner = row?.ownerJid ?? row?.instance?.owner ?? row?.owner;
        return typeof owner === 'string' ? owner.split('@')[0] || null : null;
    } catch {
        return null;
    }
};
