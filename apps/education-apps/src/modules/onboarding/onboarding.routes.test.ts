import express from 'express';
import request from 'supertest';
import onboardingRoutes from './onboarding.routes';
import { getOnboarding, updateOnboarding } from './onboarding.service';

jest.mock('./onboarding.service', () => ({
    getOnboarding: jest.fn().mockResolvedValue({ steps: [], completed: false, dismissed: false }),
    updateOnboarding: jest.fn().mockResolvedValue({ steps: [], completed: false, dismissed: true }),
}));
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
app.use('/api/onboarding', onboardingRoutes);

beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.clearAllMocks());

it('reads the checklist of the caller branch', async () => {
    const res = await request(app).get('/api/onboarding').set('Authorization', 'Bearer ADMIN').set('x-branch-id', 'b-other');
    expect(res.status).toBe(200);
    expect(getOnboarding).toHaveBeenCalledWith('b-token');
});

it('updates with the body', async () => {
    const res = await request(app).patch('/api/onboarding').set('Authorization', 'Bearer ADMIN').send({ dismissed: true });
    expect(res.status).toBe(200);
    expect(updateOnboarding).toHaveBeenCalledWith('b-token', { dismissed: true });
});

it.each(['SECRETARY', 'TEACHER', 'SUPER_ADMIN', 'SALES_AGENT', 'PARENT'])('refuses %s', async (role) => {
    const res = await request(app).get('/api/onboarding').set('Authorization', `Bearer ${role}`);
    expect(res.status).toBe(403);
    expect(getOnboarding).not.toHaveBeenCalled();
});

it('requires a login', async () => {
    expect((await request(app).get('/api/onboarding')).status).toBe(401);
});
