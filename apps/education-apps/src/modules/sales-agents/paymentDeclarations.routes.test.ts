import express from 'express';
import request from 'supertest';
import platformRoutes from '../platform/platform.routes';
import agentRoutes from './agent.routes';
import prisma from '../../config/database';
import { confirmDeclaration, declarePayment, listDeclarations } from './paymentDeclarations.service';

jest.mock('./paymentDeclarations.service', () => ({
    declarePayment: jest.fn(),
    listAgentDeclarations: jest.fn().mockResolvedValue([]),
    listDeclarations: jest.fn().mockResolvedValue([]),
    countPendingDeclarations: jest.fn().mockResolvedValue(2),
    getDeclaration: jest.fn(),
    confirmDeclaration: jest.fn(),
    rejectDeclaration: jest.fn(),
}));
jest.mock('../platform/platform.service', () => ({ getPlatformOverview: jest.fn() }));
jest.mock('../../config/database', () => ({ __esModule: true, default: { salesAgent: { findUnique: jest.fn() } } }));
// The token is the role, so each test picks who is calling.
jest.mock('../../utils/jwt', () => ({
    verifyToken: jest.fn((token: string) => ({ id: 'u1', email: 'u@test.local', role: token, schoolId: null, branchId: null })),
}));

const app = express();
app.use(express.json());
app.use('/api/platform', platformRoutes);
app.use('/api/agent', agentRoutes);

beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.clearAllMocks());

describe('agent declarations', () => {
    it('lets a sales agent declare a payment for their own account', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'agent1' });
        (declarePayment as jest.Mock).mockResolvedValue({ id: 'd1' });
        const res = await request(app).post('/api/agent/me/payment-declarations').set('Authorization', 'Bearer SALES_AGENT').send({ schoolId: 's1' });
        expect(res.status).toBe(201);
        expect(declarePayment).toHaveBeenCalledWith('agent1', { schoolId: 's1' });
    });

    it('refuses a user who is not a sales agent', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue(null);
        const res = await request(app).post('/api/agent/me/payment-declarations').set('Authorization', 'Bearer ADMIN').send({});
        expect(res.status).toBe(403);
        expect(declarePayment).not.toHaveBeenCalled();
    });
});

describe('super admin review', () => {
    it.each(['ADMIN', 'OWNER', 'SECRETARY', 'SALES_AGENT'])('refuses %s', async (role) => {
        const res = await request(app).post('/api/platform/payment-declarations/d1/confirm').set('Authorization', `Bearer ${role}`);
        expect(res.status).toBe(403);
        expect(confirmDeclaration).not.toHaveBeenCalled();
    });

    it('lists, counts and confirms for the super admin', async () => {
        expect((await request(app).get('/api/platform/payment-declarations?status=PENDING').set('Authorization', 'Bearer SUPER_ADMIN')).status).toBe(200);
        expect(listDeclarations).toHaveBeenCalledWith('PENDING');
        const count = await request(app).get('/api/platform/payment-declarations/pending-count').set('Authorization', 'Bearer SUPER_ADMIN');
        expect(count.body.data).toEqual({ pending: 2 });
        (confirmDeclaration as jest.Mock).mockResolvedValue({ id: 'd1', status: 'CONFIRMED' });
        const res = await request(app).post('/api/platform/payment-declarations/d1/confirm').set('Authorization', 'Bearer SUPER_ADMIN').send({ amount: 3000 });
        expect(res.status).toBe(200);
        expect(confirmDeclaration).toHaveBeenCalledWith('d1', 'u1', { amount: 3000 });
    });
});
