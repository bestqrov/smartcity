import express from 'express';
import request from 'supertest';
import platformRoutes from '../platform/platform.routes';
import schoolRequestsRoutes from './schoolRequests.routes';
import { countNewSchoolRequests, createSchoolRequest, listMySchoolRequests, listSchoolRequests, updateSchoolRequest } from './schoolRequests.service';

jest.mock('./schoolRequests.service', () => ({
    createSchoolRequest: jest.fn().mockResolvedValue({ id: 'r1' }),
    listMySchoolRequests: jest.fn().mockResolvedValue([]),
    listSchoolRequests: jest.fn().mockResolvedValue([]),
    countNewSchoolRequests: jest.fn().mockResolvedValue(4),
    updateSchoolRequest: jest.fn().mockResolvedValue({ id: 'r1', status: 'DONE' }),
}));
jest.mock('../platform/platform.service', () => ({ getPlatformOverview: jest.fn() }));
jest.mock('../../config/database', () => ({
    __esModule: true,
    default: { branch: { findUnique: jest.fn().mockResolvedValue({ id: 'b-token', schoolId: 's1', school: { status: 'ACTIVE' } }) } },
}));
// The token is the role; ADMIN carries its own branch.
jest.mock('../../utils/jwt', () => ({
    verifyToken: jest.fn((token: string) => ({ id: 'u1', email: 'u@test.local', role: token, schoolId: 's1', branchId: token === 'ADMIN' ? 'b-token' : null })),
}));

const app = express();
app.use(express.json());
app.use('/api/platform', platformRoutes);
app.use('/api/school-requests', schoolRequestsRoutes);

beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.clearAllMocks());

describe('school side', () => {
    it('creates a request with the branch of the token, not the body', async () => {
        const res = await request(app)
            .post('/api/school-requests')
            .set('Authorization', 'Bearer ADMIN')
            .set('x-branch-id', 'b-other')
            .send({ kind: 'FEATURE', message: 'Hi', branchId: 'b-other' });
        expect(res.status).toBe(201);
        expect(createSchoolRequest).toHaveBeenCalledWith('b-token', 'u1', { kind: 'FEATURE', message: 'Hi', branchId: 'b-other' });
    });

    it('lists the requests of the caller branch school', async () => {
        const res = await request(app).get('/api/school-requests/mine').set('Authorization', 'Bearer ADMIN');
        expect(res.status).toBe(200);
        expect(listMySchoolRequests).toHaveBeenCalledWith('b-token');
    });

    it.each(['SECRETARY', 'SUPER_ADMIN', 'SALES_AGENT', 'TEACHER', 'PARENT'])('refuses %s', async (role) => {
        const res = await request(app).post('/api/school-requests').set('Authorization', `Bearer ${role}`).send({ kind: 'FEATURE', message: 'x' });
        expect(res.status).toBe(403);
        expect(createSchoolRequest).not.toHaveBeenCalled();
    });

    it('requires a login', async () => {
        expect((await request(app).get('/api/school-requests/mine')).status).toBe(401);
    });
});

describe('super admin side', () => {
    it.each(['ADMIN', 'OWNER', 'SECRETARY', 'SALES_AGENT'])('refuses %s', async (role) => {
        const res = await request(app).patch('/api/platform/school-requests/r1').set('Authorization', `Bearer ${role}`).send({ status: 'DONE' });
        expect(res.status).toBe(403);
        expect(updateSchoolRequest).not.toHaveBeenCalled();
        expect((await request(app).get('/api/platform/school-requests/pending-count').set('Authorization', `Bearer ${role}`)).status).toBe(403);
    });

    it('lists, counts and updates for the super admin', async () => {
        expect((await request(app).get('/api/platform/school-requests?status=NEW').set('Authorization', 'Bearer SUPER_ADMIN')).status).toBe(200);
        expect(listSchoolRequests).toHaveBeenCalledWith('NEW');
        const count = await request(app).get('/api/platform/school-requests/pending-count').set('Authorization', 'Bearer SUPER_ADMIN');
        expect(count.body.data).toEqual({ pending: 4 });
        expect(countNewSchoolRequests).toHaveBeenCalled();
        const res = await request(app).patch('/api/platform/school-requests/r1').set('Authorization', 'Bearer SUPER_ADMIN').send({ status: 'DONE', reply: 'OK' });
        expect(res.status).toBe(200);
        expect(updateSchoolRequest).toHaveBeenCalledWith('r1', { status: 'DONE', reply: 'OK' });
    });
});
