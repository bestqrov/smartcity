import express from 'express';
import request from 'supertest';
import platformRoutes from './platform.routes';
import { getPlatformOverview } from './platform.service';

jest.mock('./platform.service', () => ({ getPlatformOverview: jest.fn() }));

// The token is the role, so each test picks who is calling.
jest.mock('../../utils/jwt', () => ({
    verifyToken: jest.fn((token: string) => ({ id: 'u1', email: 'u@test.local', role: token, schoolId: null, branchId: null })),
}));

const app = express();
app.use('/api/platform', platformRoutes);

const OVERVIEW = { schools: [], payments: [], agents: [], payouts: [] };

beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterAll(() => jest.restoreAllMocks());
afterEach(() => jest.clearAllMocks());

describe('GET /api/platform/overview', () => {
    it('requires a token', async () => {
        const res = await request(app).get('/api/platform/overview');
        expect(res.status).toBe(401);
        expect(getPlatformOverview).not.toHaveBeenCalled();
    });

    it.each(['ADMIN', 'OWNER', 'SECRETARY', 'SALES_AGENT'])('refuses %s', async (role) => {
        const res = await request(app).get('/api/platform/overview').set('Authorization', `Bearer ${role}`);
        expect(res.status).toBe(403);
        expect(getPlatformOverview).not.toHaveBeenCalled();
    });

    it('returns the overview to the super admin', async () => {
        (getPlatformOverview as jest.Mock).mockResolvedValue(OVERVIEW);
        const res = await request(app).get('/api/platform/overview').set('Authorization', 'Bearer SUPER_ADMIN');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual(OVERVIEW);
    });
});
