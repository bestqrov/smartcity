import express from 'express';
import request from 'supertest';
import platformRoutes from './platform.routes';
import publicRoutes from './public.routes';
import schoolsRoutes from '../schools/schools.routes';
import { getPlatformBanner, getPlatformSettings, getPublicPlatformSettings, updatePlatformSettings } from './platformSettings.service';
import { resetOwnerPassword, signupSchool, SignupClosedError, updateSchoolByAdmin } from '../schools/schools.service';

jest.mock('./platformSettings.service', () => ({
    getPlatformSettings: jest.fn(),
    updatePlatformSettings: jest.fn(),
    getPublicPlatformSettings: jest.fn(),
    getPlatformBanner: jest.fn(),
}));
jest.mock('../schools/schools.service', () => {
    class SignupClosedError extends Error {
        readonly code = 'SIGNUP_CLOSED';
    }
    return {
        SignupClosedError,
        signupSchool: jest.fn(),
        updateSchoolByAdmin: jest.fn(),
        resetOwnerPassword: jest.fn(),
        getSchoolBySchoolId: jest.fn(),
        updateSchoolProfile: jest.fn(),
        listSchools: jest.fn(),
        updateSchoolStatus: jest.fn(),
        assignPackToSchool: jest.fn(),
    };
});
jest.mock('../../utils/jwt', () => ({
    verifyToken: jest.fn((token: string) => ({ id: 'u1', email: 'u@test.local', role: token, schoolId: 's1', branchId: null })),
    generateToken: jest.fn(() => 'tok'),
}));

const app = express();
app.use(express.json());
app.use('/api/platform', platformRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/schools', schoolsRoutes);

const NON_SA = ['ADMIN', 'OWNER', 'SECRETARY', 'SALES_AGENT'];

beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterAll(() => jest.restoreAllMocks());
afterEach(() => jest.clearAllMocks());

describe('platform settings routes', () => {
    it('requires a token', async () => {
        expect((await request(app).get('/api/platform/settings')).status).toBe(401);
        expect((await request(app).put('/api/platform/settings').send({})).status).toBe(401);
    });

    it.each(NON_SA)('refuses %s', async (role) => {
        const auth = `Bearer ${role}`;
        expect((await request(app).get('/api/platform/settings').set('Authorization', auth)).status).toBe(403);
        expect((await request(app).put('/api/platform/settings').set('Authorization', auth).send({ trialDays: 3 })).status).toBe(403);
        expect(updatePlatformSettings).not.toHaveBeenCalled();
    });

    it('lets the super admin read and save', async () => {
        (getPlatformSettings as jest.Mock).mockResolvedValue({ trialDays: 15 });
        (updatePlatformSettings as jest.Mock).mockResolvedValue({ trialDays: 20 });
        const auth = 'Bearer SUPER_ADMIN';
        const get = await request(app).get('/api/platform/settings').set('Authorization', auth);
        expect(get.body.data).toEqual({ trialDays: 15 });
        const put = await request(app).put('/api/platform/settings').set('Authorization', auth).send({ trialDays: 20 });
        expect(put.status).toBe(200);
        expect(updatePlatformSettings).toHaveBeenCalledWith({ trialDays: 20 });
    });

    it('answers 400 on a validation error', async () => {
        (updatePlatformSettings as jest.Mock).mockRejectedValue(new Error('trialDays must be an integer between 1 and 90'));
        const put = await request(app).put('/api/platform/settings').set('Authorization', 'Bearer SUPER_ADMIN').send({ trialDays: 0 });
        expect(put.status).toBe(400);
    });
});

describe('banner and public routes', () => {
    it.each(['OWNER', 'ADMIN', 'SECRETARY'])('serves the banner to %s', async (role) => {
        (getPlatformBanner as jest.Mock).mockResolvedValue({ text: 'Hello' });
        const res = await request(app).get('/api/platform/banner').set('Authorization', `Bearer ${role}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ text: 'Hello' });
    });

    it('refuses the banner without a token and to a sales agent', async () => {
        expect((await request(app).get('/api/platform/banner')).status).toBe(401);
        expect((await request(app).get('/api/platform/banner').set('Authorization', 'Bearer SALES_AGENT')).status).toBe(403);
    });

    it('serves the public settings without a token', async () => {
        (getPublicPlatformSettings as jest.Mock).mockResolvedValue({ platformName: 'ArwaEduc' });
        const res = await request(app).get('/api/public/platform');
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ platformName: 'ArwaEduc' });
    });
});

describe('signup closed', () => {
    it('answers 403 SIGNUP_CLOSED', async () => {
        (signupSchool as jest.Mock).mockRejectedValue(new (SignupClosedError as any)('SIGNUP_CLOSED'));
        const res = await request(app)
            .post('/api/schools/signup')
            .send({ ownerName: 'A', ownerEmail: 'a@b.co', password: 'password1', institutionType: 'PRIVATE_SCHOOL' });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('SIGNUP_CLOSED');
    });
});

describe('school edit routes', () => {
    it.each(NON_SA)('refuses %s', async (role) => {
        const auth = `Bearer ${role}`;
        expect((await request(app).patch('/api/schools/s1').set('Authorization', auth).send({ name: 'X' })).status).toBe(403);
        expect((await request(app).patch('/api/schools/s1/owner-password').set('Authorization', auth).send({ password: 'password1' })).status).toBe(403);
        expect(updateSchoolByAdmin).not.toHaveBeenCalled();
        expect(resetOwnerPassword).not.toHaveBeenCalled();
    });

    it('lets the super admin edit and reset the password, without echoing it', async () => {
        (updateSchoolByAdmin as jest.Mock).mockResolvedValue({ id: 's1' });
        (resetOwnerPassword as jest.Mock).mockResolvedValue({ ok: true });
        const auth = 'Bearer SUPER_ADMIN';
        expect((await request(app).patch('/api/schools/s1').set('Authorization', auth).send({ name: 'X' })).status).toBe(200);
        expect(updateSchoolByAdmin).toHaveBeenCalledWith('s1', { name: 'X' });
        const res = await request(app).patch('/api/schools/s1/owner-password').set('Authorization', auth).send({ password: 'password1' });
        expect(res.status).toBe(200);
        expect(resetOwnerPassword).toHaveBeenCalledWith('s1', 'password1');
        expect(JSON.stringify(res.body)).not.toContain('password1');
    });

    it('answers 400 when the email is taken', async () => {
        (updateSchoolByAdmin as jest.Mock).mockRejectedValue(new Error('Email already exists'));
        const res = await request(app).patch('/api/schools/s1').set('Authorization', 'Bearer SUPER_ADMIN').send({ ownerEmail: 'x@y.co' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Email already exists');
    });
});
