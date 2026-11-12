import { createInstance, connectInstance, connectionState, sendText, logoutInstance, isEvolutionConfigured } from './evolution.client';

const fetchMock = jest.fn();
const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });

beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    process.env.EVOLUTION_API_URL = 'https://evo.test/';
    process.env.EVOLUTION_API_KEY = 'KEY';
});
afterAll(() => {
    delete process.env.EVOLUTION_API_URL;
    delete process.env.EVOLUTION_API_KEY;
});

const lastCall = () => {
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    return { url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined };
};

describe('evolution client', () => {
    it('is configured only with both URL and key', () => {
        expect(isEvolutionConfigured()).toBe(true);
        delete process.env.EVOLUTION_API_KEY;
        expect(isEvolutionConfigured()).toBe(false);
    });

    it('create instance', async () => {
        fetchMock.mockResolvedValue(ok({ qrcode: { base64: 'data:img', code: 'xyz' } }));
        expect(await createInstance('arwa-b1')).toEqual({ base64: 'data:img', code: 'xyz' });
        expect(lastCall()).toMatchObject({
            url: 'https://evo.test/instance/create', method: 'POST', headers: expect.objectContaining({ apikey: 'KEY' }),
            body: { instanceName: 'arwa-b1', integration: 'WHATSAPP-BAILEYS', qrcode: true },
        });
    });

    it('connect, state, send, logout', async () => {
        fetchMock.mockResolvedValueOnce(ok({ code: 'c1' }));
        expect(await connectInstance('arwa-b1')).toEqual({ base64: undefined, code: 'c1' });
        expect(lastCall()).toMatchObject({ url: 'https://evo.test/instance/connect/arwa-b1', method: 'GET' });

        fetchMock.mockResolvedValueOnce(ok({ instance: { state: 'open' } }));
        expect(await connectionState('arwa-b1')).toBe('open');
        expect(lastCall()).toMatchObject({ url: 'https://evo.test/instance/connectionState/arwa-b1', method: 'GET' });

        fetchMock.mockResolvedValueOnce(ok({}));
        await sendText('arwa-b1', '212600000000', 'hello');
        expect(lastCall()).toMatchObject({ url: 'https://evo.test/message/sendText/arwa-b1', method: 'POST', body: { number: '212600000000', text: 'hello' } });

        fetchMock.mockResolvedValueOnce(ok({}));
        await logoutInstance('arwa-b1');
        expect(lastCall()).toMatchObject({ url: 'https://evo.test/instance/logout/arwa-b1', method: 'DELETE' });
    });

    it('parses defensively and throws on HTTP errors', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'not json' });
        expect(await connectionState('x')).toBe('unknown');
        fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => '{"message":"bad"}' });
        await expect(sendText('x', '1', 't')).rejects.toThrow('Evolution API 500');
        fetchMock.mockResolvedValueOnce({ ok: false, status: 404, text: async () => '' });
        await expect(connectInstance('x')).rejects.toMatchObject({ status: 404 });
    });

    it('throws when not configured, without calling fetch', async () => {
        delete process.env.EVOLUTION_API_URL;
        await expect(sendText('x', '1', 't')).rejects.toThrow('not configured');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
