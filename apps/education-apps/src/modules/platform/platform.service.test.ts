import prisma from '../../config/database';
import { getPlatformOverview } from './platform.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        school: { findMany: jest.fn() },
        schoolPayment: { findMany: jest.fn() },
        salesAgent: { findMany: jest.fn() },
        agentPayout: { findMany: jest.fn() },
        packUpgrade: { findMany: jest.fn() },
    },
}));

const d = (iso: string) => new Date(iso);

const SCHOOLS = [
    {
        id: 's1',
        name: 'École Atlas',
        city: 'Rabat',
        institutionType: 'LANGUAGE_CENTER',
        status: 'ACTIVE',
        createdAt: d('2026-09-01T10:00:00Z'),
        trialEndsAt: d('2026-09-15T00:00:00Z'),
        pack: { name: 'Pro' },
        salesAgent: { id: 'a1', name: 'Youssef', code: 'YOUSSEF22' },
    },
    {
        id: 's2',
        name: 'Crèche Soleil',
        city: null,
        institutionType: null,
        status: 'PENDING',
        createdAt: d('2026-11-02T10:00:00Z'),
        trialEndsAt: d('2026-11-16T00:00:00Z'),
        pack: null,
        salesAgent: null,
    },
];

const PAYMENTS = [
    {
        id: 'p2',
        schoolId: 's1',
        amount: 300.1,
        period: 'MONTHLY',
        paidAt: d('2026-11-01T00:00:00Z'),
        packName: 'Pro',
        salesAgentId: 'a1',
        commissionAmount: 30.01,
        school: { name: 'École Atlas' },
        salesAgent: { name: 'Youssef' },
    },
    {
        id: 'p1',
        schoolId: 's1',
        amount: 300.2,
        period: 'MONTHLY',
        paidAt: d('2026-10-01T00:00:00Z'),
        packName: null,
        salesAgentId: null,
        commissionAmount: 0,
        school: { name: 'École Atlas' },
        salesAgent: null,
    },
];

const AGENTS = [
    {
        id: 'a1',
        name: 'Youssef',
        code: 'YOUSSEF22',
        isHouse: false,
        active: true,
        user: { avatar: 'data:image/png;base64,AAA' },
        schools: [{ status: 'ACTIVE' }, { status: 'PENDING' }],
        payments: [{ commissionAmount: 30.01 }, { commissionAmount: 20 }],
        payouts: [{ amount: 25 }],
    },
    {
        id: 'a2',
        name: 'Maison',
        code: 'ARWA',
        isHouse: true,
        active: true,
        user: null,
        schools: [],
        payments: [],
        payouts: [],
    },
];

const PAYOUTS = [{ salesAgentId: 'a1', amount: 25, paidAt: d('2026-10-20T00:00:00Z') }];

const mockAll = () => {
    (prisma.school.findMany as jest.Mock).mockResolvedValue(SCHOOLS);
    (prisma.schoolPayment.findMany as jest.Mock).mockResolvedValue(PAYMENTS);
    (prisma.salesAgent.findMany as jest.Mock).mockResolvedValue(AGENTS);
    (prisma.agentPayout.findMany as jest.Mock).mockResolvedValue(PAYOUTS);
    (prisma.packUpgrade.findMany as jest.Mock).mockResolvedValue([
        {
            id: 'u1',
            schoolId: 's1',
            fromPackName: 'Pro',
            toPackName: 'Premium',
            toMonthlyPrice: 650,
            createdAt: d('2026-11-01T10:00:00Z'),
            dueAt: d('2026-12-01T10:00:00Z'),
            school: { name: 'École Atlas' },
        },
    ]);
};

// Every key of a value, at any depth.
const keysOf = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(keysOf);
    if (value && typeof value === 'object' && !(value instanceof Date)) {
        return Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child)]);
    }
    return [];
};

afterEach(() => jest.clearAllMocks());

describe('getPlatformOverview', () => {
    it('returns the schools with pack, agent and payment summary', async () => {
        mockAll();
        const overview = await getPlatformOverview();

        expect(overview.schools).toEqual([
            {
                id: 's1',
                name: 'École Atlas',
                city: 'Rabat',
                institutionType: 'LANGUAGE_CENTER',
                status: 'ACTIVE',
                packName: 'Pro',
                salesAgent: { id: 'a1', name: 'Youssef', code: 'YOUSSEF22' },
                createdAt: d('2026-09-01T10:00:00Z'),
                trialEndsAt: d('2026-09-15T00:00:00Z'),
                totalPaid: 600.3,
                lastPaidAt: d('2026-11-01T00:00:00Z'),
            },
            {
                id: 's2',
                name: 'Crèche Soleil',
                city: null,
                institutionType: null,
                status: 'PENDING',
                packName: null,
                salesAgent: null,
                createdAt: d('2026-11-02T10:00:00Z'),
                trialEndsAt: d('2026-11-16T00:00:00Z'),
                totalPaid: 0,
                lastPaidAt: null,
            },
        ]);
    });

    it('returns the payments flattened with school and agent names', async () => {
        mockAll();
        const overview = await getPlatformOverview();

        expect(overview.payments).toEqual([
            {
                id: 'p2',
                schoolId: 's1',
                schoolName: 'École Atlas',
                amount: 300.1,
                period: 'MONTHLY',
                paidAt: d('2026-11-01T00:00:00Z'),
                packName: 'Pro',
                salesAgentId: 'a1',
                salesAgentName: 'Youssef',
                commissionAmount: 30.01,
            },
            {
                id: 'p1',
                schoolId: 's1',
                schoolName: 'École Atlas',
                amount: 300.2,
                period: 'MONTHLY',
                paidAt: d('2026-10-01T00:00:00Z'),
                packName: null,
                salesAgentId: null,
                salesAgentName: null,
                commissionAmount: 0,
            },
        ]);
    });

    it('returns the agents with their avatar and totals (balance included)', async () => {
        mockAll();
        const overview = await getPlatformOverview();

        expect(overview.agents).toEqual([
            {
                id: 'a1',
                name: 'Youssef',
                code: 'YOUSSEF22',
                isHouse: false,
                active: true,
                avatar: 'data:image/png;base64,AAA',
                totals: { schools: 2, activeSchools: 1, totalCommissions: 50.01, totalPayouts: 25, balance: 25.01 },
            },
            {
                id: 'a2',
                name: 'Maison',
                code: 'ARWA',
                isHouse: true,
                active: true,
                avatar: null,
                totals: { schools: 0, activeSchools: 0, totalCommissions: 0, totalPayouts: 0, balance: 0 },
            },
        ]);
    });

    it('returns the payouts as agentId, amount and date', async () => {
        mockAll();
        const overview = await getPlatformOverview();
        expect(overview.payouts).toEqual([{ agentId: 'a1', amount: 25, paidAt: d('2026-10-20T00:00:00Z') }]);
    });

    it('returns the unsettled upgrades that have a deadline, earliest deadline first', async () => {
        mockAll();
        const overview = await getPlatformOverview();

        expect(prisma.packUpgrade.findMany).toHaveBeenCalledWith({
            where: { dueAt: { not: null }, OR: [{ settledAt: null }, { settledAt: { isSet: false } }] },
            orderBy: { dueAt: 'asc' },
            select: {
                id: true,
                schoolId: true,
                fromPackName: true,
                toPackName: true,
                toMonthlyPrice: true,
                createdAt: true,
                dueAt: true,
                school: { select: { name: true } },
            },
        });
        expect(overview.pendingUpgrades).toEqual([
            {
                id: 'u1',
                schoolId: 's1',
                schoolName: 'École Atlas',
                fromPackName: 'Pro',
                toPackName: 'Premium',
                toMonthlyPrice: 650,
                createdAt: d('2026-11-01T10:00:00Z'),
                dueAt: d('2026-12-01T10:00:00Z'),
            },
        ]);
    });

    it('selects explicit fields only: no password, user id, owner contact or bank details', async () => {
        mockAll();
        await getPlatformOverview();

        const queries = [prisma.school.findMany, prisma.schoolPayment.findMany, prisma.salesAgent.findMany, prisma.agentPayout.findMany].map(
            (fn) => (fn as jest.Mock).mock.calls[0][0]
        );
        for (const query of queries) {
            expect(query.select).toBeDefined();
            expect(query.include).toBeUndefined();
            const selected = keysOf(query.select);
            for (const sensitive of ['password', 'userId', 'email', 'ownerEmail', 'ownerPhone', 'rib', 'bankName', 'accountHolder', 'payoutPhone', 'note']) {
                expect(selected).not.toContain(sensitive);
            }
        }
        // The agent's user relation is read for the photo only.
        expect(queries[2].select.user).toEqual({ select: { avatar: true } });
    });

    it('does not leak sensitive keys even if the database returns more than selected', async () => {
        mockAll();
        (prisma.salesAgent.findMany as jest.Mock).mockResolvedValue(
            AGENTS.map((agent) => ({ ...agent, userId: 'u1', rib: '123', user: agent.user && { ...agent.user, password: 'hash', email: 'x@y.z' } }))
        );
        (prisma.school.findMany as jest.Mock).mockResolvedValue(SCHOOLS.map((school) => ({ ...school, ownerEmail: 'o@x.z', ownerPhone: '06' })));

        const keys = keysOf(await getPlatformOverview());
        for (const sensitive of ['password', 'userId', 'email', 'ownerEmail', 'ownerPhone', 'rib', 'user']) {
            expect(keys).not.toContain(sensitive);
        }
    });

    it('works on an empty platform', async () => {
        (prisma.school.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.schoolPayment.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.salesAgent.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.agentPayout.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.packUpgrade.findMany as jest.Mock).mockResolvedValue([]);
        await expect(getPlatformOverview()).resolves.toEqual({ schools: [], payments: [], agents: [], payouts: [], pendingUpgrades: [] });
    });
});
