import prisma from '../../config/database';
import { getOnboarding, updateOnboarding } from './onboarding.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        branch: { findUnique: jest.fn() },
        settings: { findUnique: jest.fn(), update: jest.fn() },
        tuitionFee: { count: jest.fn() },
        pricing: { count: jest.fn() },
        formation: { count: jest.fn() },
        group: { count: jest.fn() },
        teacher: { count: jest.fn() },
        user: { count: jest.fn() },
        vehicle: { count: jest.fn() },
        transportRoute: { count: jest.fn() },
        student: { count: jest.fn() },
    },
}));

const m = (fn: unknown) => fn as jest.Mock;
const B = 'b1';
const COUNTED = ['tuitionFee', 'pricing', 'formation', 'group', 'teacher', 'user', 'vehicle', 'transportRoute', 'student'] as const;

const setup = (opts: {
    type?: string | null;
    phone?: string | null;
    features?: string[] | null; // null = no pack
    settings?: Record<string, unknown> | null;
    counts?: Partial<Record<(typeof COUNTED)[number], number>>;
}) => {
    m(prisma.branch.findUnique).mockResolvedValue({
        school: {
            institutionType: opts.type === undefined ? 'TUTORING_CENTER' : opts.type,
            phone: opts.phone ?? null,
            pack: opts.features === null || opts.features === undefined ? null : { features: opts.features },
        },
    });
    m(prisma.settings.findUnique).mockResolvedValue(
        opts.settings === null
            ? null
            : { schoolName: 'Al Amal', contactInfo: '0600000000', schoolCycles: [], onboardingSkipped: [], onboardingDismissed: false, ...opts.settings },
    );
    for (const key of COUNTED) m((prisma as any)[key].count).mockResolvedValue(opts.counts?.[key] ?? 0);
};

const keys = (r: { steps: { key: string }[] }) => r.steps.map((s) => s.key);
const step = (r: { steps: { key: string }[] }, key: string) => r.steps.find((s) => s.key === key) as any;

beforeEach(() => jest.clearAllMocks());

describe('visible steps', () => {
    it('centre with no pack: every step but formations, transport shown', async () => {
        setup({});
        expect(keys(await getOnboarding(B))).toEqual(['profile', 'prices', 'groups', 'teachers', 'staff', 'transport', 'firstStudent']);
    });

    it('formations only for vocational training', async () => {
        setup({ type: 'VOCATIONAL_TRAINING' });
        expect(keys(await getOnboarding(B))).toContain('formations');
        expect(keys(await getOnboarding(B)).indexOf('formations')).toBe(2);
    });

    it('transport hidden when the pack lacks TRANSPORT, shown when it has it', async () => {
        setup({ features: ['PARENT_PORTAL'] });
        expect(keys(await getOnboarding(B))).not.toContain('transport');
        setup({ features: ['TRANSPORT'] });
        expect(keys(await getOnboarding(B))).toContain('transport');
    });
});

describe('done', () => {
    it('profile needs a name and a phone; a private school also needs cycles', async () => {
        setup({ settings: { contactInfo: null } });
        expect(step(await getOnboarding(B), 'profile').done).toBe(false);
        setup({ settings: { contactInfo: null }, phone: '0522000000' });
        expect(step(await getOnboarding(B), 'profile').done).toBe(true);
        setup({ type: 'PRIVATE_SCHOOL' });
        expect(step(await getOnboarding(B), 'profile').done).toBe(false);
        setup({ type: 'PRIVATE_SCHOOL', settings: { schoolCycles: ['PRIMAIRE'] } });
        expect(step(await getOnboarding(B), 'profile').done).toBe(true);
    });

    it('profile is not done without settings', async () => {
        setup({ settings: null });
        expect(step(await getOnboarding(B), 'profile').done).toBe(false);
    });

    it('prices use TuitionFee in school mode and active Pricing otherwise', async () => {
        setup({ counts: { pricing: 1 } });
        expect(step(await getOnboarding(B), 'prices').done).toBe(true);
        setup({ settings: { schoolCycles: ['COLLEGE'] }, counts: { pricing: 1 } });
        expect(step(await getOnboarding(B), 'prices').done).toBe(false);
        setup({ type: 'PRIVATE_SCHOOL', counts: { tuitionFee: 2 } });
        expect(step(await getOnboarding(B), 'prices').done).toBe(true);
    });

    it('transport needs a vehicle and a route', async () => {
        setup({ counts: { vehicle: 1 } });
        expect(step(await getOnboarding(B), 'transport').done).toBe(false);
        setup({ counts: { vehicle: 1, transportRoute: 1 } });
        expect(step(await getOnboarding(B), 'transport').done).toBe(true);
    });

    it('counts only the branch, and staff only SECRETARY users', async () => {
        setup({ counts: { group: 1, teacher: 1, user: 1, student: 1 } });
        const r = await getOnboarding(B);
        for (const k of ['groups', 'teachers', 'staff', 'firstStudent']) expect(step(r, k).done).toBe(true);
        expect(m(prisma.group.count)).toHaveBeenCalledWith({ where: { branchId: B } });
        expect(m(prisma.user.count)).toHaveBeenCalledWith({ where: { branchId: B, role: 'SECRETARY' } });
    });
});

describe('completed, skipped, href', () => {
    it('completed when every step is done or skipped', async () => {
        setup({
            counts: { pricing: 1, group: 1, teacher: 1, student: 1 },
            settings: { onboardingSkipped: ['staff', 'transport'] },
        });
        const r = await getOnboarding(B);
        expect(r.completed).toBe(true);
        expect(step(r, 'staff')).toMatchObject({ skipped: true, optional: true, done: false });
    });

    it('optional steps never block completion (schools already running are not nagged)', async () => {
        setup({ counts: { pricing: 1, group: 1, teacher: 1, student: 1 } });
        const r = await getOnboarding(B);
        expect(r.completed).toBe(true);
        expect(step(r, 'staff')).toMatchObject({ done: false, skipped: false });
    });

    it('not completed while a required step is missing', async () => {
        setup({ counts: { pricing: 1, group: 1, teacher: 1 }, settings: { onboardingSkipped: ['staff', 'transport'] } });
        expect((await getOnboarding(B)).completed).toBe(false);
    });

    it('returns the page of each step and the dismissed flag', async () => {
        setup({ settings: { onboardingDismissed: true } });
        const r = await getOnboarding(B);
        expect(r.dismissed).toBe(true);
        expect(step(r, 'groups').href).toBe('/admin/groups');
        expect(step(r, 'firstStudent').href).toBe('/admin/inscriptions');
    });
});

describe('updateOnboarding', () => {
    beforeEach(() => {
        setup({});
        m(prisma.settings.update).mockResolvedValue({});
    });

    it('skips and unskips an optional step', async () => {
        await updateOnboarding(B, { skip: 'transport' });
        expect(m(prisma.settings.update)).toHaveBeenCalledWith({ where: { branchId: B }, data: { onboardingSkipped: ['transport'] } });
        setup({ settings: { onboardingSkipped: ['transport', 'staff'] } });
        await updateOnboarding(B, { unskip: 'transport' });
        expect(m(prisma.settings.update)).toHaveBeenLastCalledWith({ where: { branchId: B }, data: { onboardingSkipped: ['staff'] } });
    });

    it('does not add the same key twice', async () => {
        setup({ settings: { onboardingSkipped: ['staff'] } });
        await updateOnboarding(B, { skip: 'staff' });
        expect(m(prisma.settings.update)).toHaveBeenCalledWith({ where: { branchId: B }, data: { onboardingSkipped: ['staff'] } });
    });

    it('refuses a required or unknown key', async () => {
        await expect(updateOnboarding(B, { skip: 'groups' })).rejects.toThrow('Only optional steps can be skipped');
        await expect(updateOnboarding(B, { skip: 'nope' })).rejects.toThrow('Only optional steps can be skipped');
    });

    it('sets dismissed', async () => {
        await updateOnboarding(B, { dismissed: true });
        expect(m(prisma.settings.update)).toHaveBeenCalledWith({ where: { branchId: B }, data: { onboardingDismissed: true } });
        await expect(updateOnboarding(B, { dismissed: 'yes' })).rejects.toThrow('dismissed must be a boolean');
    });

    it('needs the branch settings and one action', async () => {
        setup({ settings: null });
        await expect(updateOnboarding(B, { dismissed: true })).rejects.toThrow('Settings not found');
        setup({});
        await expect(updateOnboarding(B, {})).rejects.toThrow('Nothing to update');
    });
});
