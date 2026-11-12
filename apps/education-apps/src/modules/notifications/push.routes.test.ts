import express from 'express';
import request from 'supertest';
import pushRoutes from './push.routes';
import { subscribe, unsubscribe } from './push.service';

jest.mock('./push.service', () => ({ subscribe: jest.fn(), unsubscribe: jest.fn() }));

const app = express();
app.use(express.json());
app.use('/api/push', pushRoutes);

beforeEach(() => jest.clearAllMocks());

describe('/api/push', () => {
    it('GET /public-key returns the VAPID public key only', async () => {
        process.env.VAPID_PUBLIC_KEY = 'PUB';
        const res = await request(app).get('/api/push/public-key');
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ publicKey: 'PUB' });
        delete process.env.VAPID_PUBLIC_KEY;
    });

    it('POST /subscribe/:token', async () => {
        (subscribe as jest.Mock).mockResolvedValue({ subscribed: true });
        const body = { subscription: { endpoint: 'https://e', keys: { p256dh: 'P', auth: 'A' } }, lang: 'fr' };
        const res = await request(app).post('/api/push/subscribe/tok').send(body);
        expect(res.status).toBe(201);
        expect(subscribe).toHaveBeenCalledWith('tok', body.subscription, 'fr');
    });

    it('unknown token → 404', async () => {
        (subscribe as jest.Mock).mockRejectedValue(new Error('Parent not found'));
        const res = await request(app).post('/api/push/subscribe/bad').send({});
        expect(res.status).toBe(404);
    });

    it('DELETE /subscribe/:token', async () => {
        (unsubscribe as jest.Mock).mockResolvedValue({ subscribed: false });
        const res = await request(app).delete('/api/push/subscribe/tok').send({ endpoint: 'https://e' });
        expect(res.status).toBe(200);
        expect(unsubscribe).toHaveBeenCalledWith('tok', 'https://e');
    });
});
