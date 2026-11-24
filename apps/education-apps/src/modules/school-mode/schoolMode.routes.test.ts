import express from 'express';
import request from 'supertest';
import routes from './schoolMode.routes';
import { saveTuitionGrid } from './tuitionFees.service';
import { registerSchoolStudent } from './inscription.service';
import { collectMonth, listDues } from './dues.service';
import prisma from '../../config/database';

jest.mock('./tuitionFees.service', () => ({ getTuitionGrid: jest.fn().mockResolvedValue([]), saveTuitionGrid: jest.fn().mockResolvedValue([]) }));
jest.mock('./inscription.service', () => ({ registerSchoolStudent: jest.fn().mockResolvedValue({ student: { id: 's1' }, summary: {} }) }));
jest.mock('./dues.service', () => ({ listDues: jest.fn().mockResolvedValue({ rows: [] }), collectMonth: jest.fn().mockResolvedValue({ id: 'p1' }) }));
jest.mock('../../middlewares/tenantScope.middleware', () => ({ tenantScopeMiddleware: (req: any, _res: any, next: any) => ((req.branchId = 'b1'), next()) }));
jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        branch: { findUnique: jest.fn() },
        settings: { findUnique: jest.fn() },
    },
}));
jest.mock('../../utils/jwt', () => ({ verifyToken: jest.fn((token: string) => ({ id: 'u1', email: 'u@test.local', role: token, schoolId: 's', branchId: 'b1' })) }));

const app = express();
app.use(express.json());
app.use('/api/school-mode', routes);
beforeAll(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
const db = prisma as any;
beforeEach(() => {
    db.branch.findUnique.mockResolvedValue({ school: { institutionType: 'PRIVATE_SCHOOL' } });
    db.settings.findUnique.mockResolvedValue({ schoolCycles: [] });
});
afterEach(() => jest.clearAllMocks());

it('lets the secretary register and see dues, not change the fee grid', async () => {
    expect((await request(app).post('/api/school-mode/inscriptions').set('Authorization', 'Bearer SECRETARY').send({ name: 'x' })).status).toBe(201);
    expect(registerSchoolStudent).toHaveBeenCalledWith('b1', { name: 'x' });
    expect((await request(app).get('/api/school-mode/dues?month=2026-11').set('Authorization', 'Bearer SECRETARY')).status).toBe(200);
    expect(listDues).toHaveBeenCalledWith('b1', '2026-11');
    expect((await request(app).put('/api/school-mode/tuition-fees').set('Authorization', 'Bearer SECRETARY').send({ items: [] })).status).toBe(403);
    expect(saveTuitionGrid).not.toHaveBeenCalled();
});

it('lets the owner save the grid and refuses sales agents', async () => {
    expect((await request(app).put('/api/school-mode/tuition-fees').set('Authorization', 'Bearer OWNER').send({ items: [] })).status).toBe(200);
    expect((await request(app).get('/api/school-mode/tuition-fees').set('Authorization', 'Bearer SALES_AGENT')).status).toBe(403);
});

it('returns 201 with the transport error when only the transport failed', async () => {
    (registerSchoolStudent as jest.Mock).mockResolvedValueOnce({ student: { id: 's1' }, summary: {}, transportError: 'Plus de place' });
    const res = await request(app).post('/api/school-mode/inscriptions').set('Authorization', 'Bearer SECRETARY').send({ name: 'x' });
    expect(res.status).toBe(201);
    expect(res.body.data.transportError).toBe('Plus de place');
});

it('records a monthly payment', async () => {
    const res = await request(app).post('/api/school-mode/dues/payments').set('Authorization', 'Bearer SECRETARY').send({ studentId: 's1', month: '2026-11' });
    expect(res.status).toBe(201);
    expect(collectMonth).toHaveBeenCalledWith('b1', { studentId: 's1', month: '2026-11' });
});

it('answers 401 without a token', async () => {
    expect((await request(app).get('/api/school-mode/dues')).status).toBe(401);
    expect(listDues).not.toHaveBeenCalled();
});

it('lets an admin save the grid', async () => {
    expect((await request(app).put('/api/school-mode/tuition-fees').set('Authorization', 'Bearer ADMIN').send({ items: [] })).status).toBe(200);
    expect(saveTuitionGrid).toHaveBeenCalledWith('b1', []);
});

it('refuses a bad month', async () => {
    expect((await request(app).get('/api/school-mode/dues?month=2026-13').set('Authorization', 'Bearer ADMIN')).status).toBe(400);
    expect((await request(app).get('/api/school-mode/dues?month=a&month=b').set('Authorization', 'Bearer ADMIN')).status).toBe(400);
    expect(listDues).not.toHaveBeenCalled();
});

it('allows a branch with cycles even without the private school type', async () => {
    db.branch.findUnique.mockResolvedValue({ school: { institutionType: 'LANGUAGE_CENTER' } });
    db.settings.findUnique.mockResolvedValue({ schoolCycles: ['PRIMAIRE'] });
    expect((await request(app).get('/api/school-mode/dues').set('Authorization', 'Bearer ADMIN')).status).toBe(200);
});

it('answers 403 SCHOOL_MODE_DISABLED for a school without school mode', async () => {
    db.branch.findUnique.mockResolvedValue({ school: { institutionType: 'LANGUAGE_CENTER' } });
    db.settings.findUnique.mockResolvedValue({ schoolCycles: [] });
    const res = await request(app).get('/api/school-mode/dues').set('Authorization', 'Bearer ADMIN');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SCHOOL_MODE_DISABLED');
    expect(listDues).not.toHaveBeenCalled();
});
