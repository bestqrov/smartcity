import prisma from '../../config/database';
import {
    DEFAULT_PLATFORM_SETTINGS,
    getPlatformBanner,
    getPlatformSettings,
    getPublicPlatformSettings,
    updatePlatformSettings,
    validatePlatformSettings,
} from './platformSettings.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: { platformSettings: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } },
}));

const ps = prisma.platformSettings as unknown as { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };

beforeEach(() => jest.clearAllMocks());

describe('getPlatformSettings', () => {
    it('creates the singleton with the current hardcoded defaults on first read', async () => {
        ps.findUnique.mockResolvedValue(null);
        ps.create.mockImplementation(async ({ data }) => ({ id: 'x', ...data }));
        const s = await getPlatformSettings();
        expect(ps.create).toHaveBeenCalledWith({ data: DEFAULT_PLATFORM_SETTINGS });
        expect(s).toMatchObject({
            trialDays: 15,
            signupOpen: true,
            signupPeriods: ['MONTHLY', 'SEMIANNUAL', 'YEARLY'],
            platformName: 'ArwaEduc',
            bannerText: null,
            bannerActive: false,
        });
        expect(s).not.toHaveProperty('key');
    });

    it('returns the stored document without creating', async () => {
        ps.findUnique.mockResolvedValue({ ...DEFAULT_PLATFORM_SETTINGS, trialDays: 7 });
        expect((await getPlatformSettings()).trialDays).toBe(7);
        expect(ps.create).not.toHaveBeenCalled();
    });

    it('re-reads when a concurrent first read created it', async () => {
        ps.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...DEFAULT_PLATFORM_SETTINGS, trialDays: 9 });
        ps.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
        expect((await getPlatformSettings()).trialDays).toBe(9);
    });
});

describe('public views', () => {
    it('public settings carry no banner', async () => {
        ps.findUnique.mockResolvedValue({ ...DEFAULT_PLATFORM_SETTINGS, bannerText: 'Hi', bannerActive: true });
        const pub = await getPublicPlatformSettings();
        expect(pub).not.toHaveProperty('bannerText');
        expect(pub).not.toHaveProperty('bannerActive');
        expect(pub).toHaveProperty('trialDays', 15);
    });

    it('banner text only when active', async () => {
        ps.findUnique.mockResolvedValue({ ...DEFAULT_PLATFORM_SETTINGS, bannerText: 'Hi', bannerActive: false });
        expect(await getPlatformBanner()).toEqual({ text: null });
        ps.findUnique.mockResolvedValue({ ...DEFAULT_PLATFORM_SETTINGS, bannerText: ' Hi ', bannerActive: true });
        expect(await getPlatformBanner()).toEqual({ text: 'Hi' });
    });
});

describe('validatePlatformSettings', () => {
    it.each([0, 91, 1.5, '15', null])('refuses trialDays %p', (trialDays) => {
        expect(() => validatePlatformSettings({ trialDays })).toThrow('trialDays');
    });

    it('accepts trialDays bounds', () => {
        expect(validatePlatformSettings({ trialDays: 1 })).toEqual({ trialDays: 1 });
        expect(validatePlatformSettings({ trialDays: 90 })).toEqual({ trialDays: 90 });
    });

    it.each([[[]], [['WEEKLY']], ['YEARLY']])('refuses signupPeriods %p', (signupPeriods) => {
        expect(() => validatePlatformSettings({ signupPeriods })).toThrow('signupPeriods');
    });

    it('orders and dedupes signupPeriods', () => {
        expect(validatePlatformSettings({ signupPeriods: ['YEARLY', 'MONTHLY', 'YEARLY'] })).toEqual({ signupPeriods: ['MONTHLY', 'YEARLY'] });
    });

    it('checks email and phone formats', () => {
        expect(() => validatePlatformSettings({ supportEmail: 'nope' })).toThrow('supportEmail is invalid');
        expect(() => validatePlatformSettings({ supportPhone: 'abc' })).toThrow('supportPhone is invalid');
        expect(() => validatePlatformSettings({ supportWhatsapp: '12' })).toThrow('supportWhatsapp is invalid');
        expect(validatePlatformSettings({ supportEmail: 'A@B.co', supportPhone: '+212 608183886', supportWhatsapp: '' })).toEqual({
            supportEmail: 'a@b.co',
            supportPhone: '+212 608183886',
            supportWhatsapp: null,
        });
    });

    it('refuses a non-boolean signupOpen, an empty platformName, and ignores unknown fields', () => {
        expect(() => validatePlatformSettings({ signupOpen: 'yes' })).toThrow('signupOpen');
        expect(() => validatePlatformSettings({ platformName: '  ' })).toThrow('platformName');
        expect(validatePlatformSettings({ key: 'hack', id: 'x' })).toEqual({});
    });
});

describe('updatePlatformSettings', () => {
    it('saves only validated fields', async () => {
        ps.findUnique.mockResolvedValue({ ...DEFAULT_PLATFORM_SETTINGS });
        ps.update.mockImplementation(async ({ data }) => ({ ...DEFAULT_PLATFORM_SETTINGS, ...data }));
        const s = await updatePlatformSettings({ trialDays: 30, signupOpen: false, key: 'other' });
        expect(ps.update).toHaveBeenCalledWith({ where: { key: 'default' }, data: { trialDays: 30, signupOpen: false } });
        expect(s.trialDays).toBe(30);
    });

    it('refuses an active banner without text', async () => {
        ps.findUnique.mockResolvedValue({ ...DEFAULT_PLATFORM_SETTINGS });
        await expect(updatePlatformSettings({ bannerActive: true })).rejects.toThrow('bannerText');
        expect(ps.update).not.toHaveBeenCalled();
    });
});
