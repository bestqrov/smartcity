import type { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { comparePassword, hashPassword } from '../../utils/bcrypt';
import { assertId } from '../transport/ids';
import {
    CODE_PATTERN,
    normalizeCode,
    roundMoney,
    sanitizeAgentSelfUpdate,
    sanitizeAgentUpdate,
    sanitizeEmail,
    sanitizeNewPassword,
    sanitizeNewAgent,
    sanitizePayout,
    type AgentUpdateData,
    type PackRateData,
    type PeriodValue,
    type RateSource,
    PERIODS,
    resolveCommissionRate,
} from './salesAgents.validation';
import { allocatePayouts, clientStatus, countStatuses, type Allocation } from './salesAgents.statuses';

// The agent behind a referral code typed at signup. Only active agents' codes are accepted.
export const resolveReferralCode = async (raw: unknown) => {
    if (raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim())) {
        throw new Error('Referral code is required');
    }
    const code = normalizeCode(raw);
    // Non-strings normalise to '' and fail here, so they never reach Prisma.
    if (!CODE_PATTERN.test(code)) throw new Error('Invalid referral code');

    const agent = await prisma.salesAgent.findFirst({ where: { code, active: true } });
    if (!agent) throw new Error('Invalid referral code');
    return agent;
};

// Public check for the signup form: says only whether the code works, never who it belongs to.
export const isReferralCodeValid = async (raw: unknown): Promise<boolean> => {
    try {
        await resolveReferralCode(raw);
        return true;
    } catch (error) {
        if (error instanceof Error && (error.message === 'Referral code is required' || error.message === 'Invalid referral code')) {
            return false;
        }
        throw error;
    }
};

const sum = (values: number[]): number => roundMoney(values.reduce((total, value) => total + value, 0));

export const buildTotals = (
    schools: { status: string }[],
    payments: { commissionAmount: number }[],
    payouts: { amount: number }[]
) => {
    const totalCommissions = sum(payments.map((payment) => payment.commissionAmount));
    const totalPayouts = sum(payouts.map((payout) => payout.amount));
    return {
        schools: schools.length,
        activeSchools: schools.filter((school) => school.status === 'ACTIVE').length,
        totalCommissions,
        totalPayouts,
        balance: roundMoney(totalCommissions - totalPayouts),
    };
};

type StoredPackRate = { packId: string; period: string; rate: number };
type PackLabels = Map<string, { name: string; code: string }>;

// Exceptions store only the pack id; names are looked up so a renamed pack shows its current name.
// The code disambiguates packs that share a name across institution types (e.g. "Pro").
const packLabels = async (lists: StoredPackRate[][]): Promise<PackLabels> => {
    const ids = [...new Set(lists.flat().map((rate) => rate.packId))];
    if (ids.length === 0) return new Map();
    const packs = await prisma.pack.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, code: true } });
    return new Map(packs.map((pack) => [pack.id, { name: pack.name, code: pack.code }]));
};

const withPackNames = <T extends StoredPackRate>(rates: T[], labels: PackLabels) =>
    rates.map((rate) => ({
        ...rate,
        packName: labels.get(rate.packId)?.name ?? null,
        packCode: labels.get(rate.packId)?.code ?? null,
    }));

const assertPacksExist = async (rates: PackRateData[]) => {
    const ids = [...new Set(rates.map((rate) => rate.packId))];
    if (ids.length === 0) return;
    const found = await prisma.pack.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw new Error('Unknown pack in pack rates');
};

const earnsCommission = (data: AgentUpdateData): boolean =>
    [data.monthlyRate, data.semiannualRate, data.yearlyRate].some((rate) => rate !== undefined && rate !== 0) ||
    (data.packRates?.length ?? 0) > 0;

export const listAgents = async () => {
    const agents = await prisma.salesAgent.findMany({
        orderBy: [{ isHouse: 'desc' }, { createdAt: 'asc' }],
        include: {
            user: { select: { email: true, avatar: true } },
            schools: { select: { status: true } },
            payments: { select: { commissionAmount: true } },
            payouts: { select: { amount: true } },
        },
    });
    const labels = await packLabels(agents.map((agent) => agent.packRates));

    return agents.map(({ user, schools, payments, payouts, packRates, userId: _userId, ...agent }) => ({
        ...agent,
        packRates: withPackNames(packRates, labels),
        email: user?.email ?? null,
        avatar: user?.avatar ?? null,
        totals: buildTotals(schools, payments, payouts),
    }));
};

const LINKABLE_ROLES = ['OWNER', 'ADMIN', 'SECRETARY'];

// An existing school account can also be a sales agent: the agent is linked to it, nothing on the user changes.
const assertLinkable = async (user: { id: string; role: string }) => {
    if (user.role === 'SALES_AGENT') throw new Error('This account is already a sales agent');
    if (!LINKABLE_ROLES.includes(user.role)) throw new Error("A super admin account can't be a sales agent");
    if (await prisma.salesAgent.findUnique({ where: { userId: user.id } })) {
        throw new Error('This account is already a sales agent');
    }
};

const createLinkedAgent = async (data: ReturnType<typeof sanitizeNewAgent>, userId: string) => {
    try {
        const { userId: _userId, ...created } = await prisma.salesAgent.create({
            data: {
                name: data.name,
                phone: data.phone,
                code: data.code,
                monthlyRate: data.monthlyRate,
                semiannualRate: data.semiannualRate,
                yearlyRate: data.yearlyRate,
                packRates: data.packRates,
                userId,
            },
        });
        return created;
    } catch (error) {
        if ((error as { code?: string })?.code === 'P2002') throw new Error('Email or code already exists');
        throw error;
    }
};

export const createAgent = async (input: Record<string, unknown>) => {
    const data = sanitizeNewAgent(input);

    if (await prisma.salesAgent.findUnique({ where: { code: data.code } })) throw new Error('This code is already used');
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
        if (!data.linkExistingUser) {
            throw Object.assign(new Error('Email already exists'), { details: { existingRole: existingUser.role } });
        }
        await assertLinkable(existingUser);
        await assertPacksExist(data.packRates);
        return createLinkedAgent(data, existingUser.id);
    }
    if (data.linkExistingUser) throw new Error('No account found with this email');
    await assertPacksExist(data.packRates);

    const password = await hashPassword(data.password);

    try {
        const { userId: _userId, ...created } = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: { email: data.email, password, name: data.name, role: 'SALES_AGENT', gsm: data.phone },
            });
            return tx.salesAgent.create({
                data: {
                    name: data.name,
                    phone: data.phone,
                    code: data.code,
                    monthlyRate: data.monthlyRate,
                    semiannualRate: data.semiannualRate,
                    yearlyRate: data.yearlyRate,
                    packRates: data.packRates,
                    userId: user.id,
                },
            });
        });
        return created;
    } catch (error) {
        if ((error as { code?: string })?.code === 'P2002') throw new Error('Email or code already exists');
        throw error;
    }
};

// New rates only apply to payments recorded afterwards: past payments keep their frozen rate.
export const updateAgent = async (id: string, input: Record<string, unknown>) => {
    assertId('Sales agent id', id);
    const data = sanitizeAgentUpdate(input);

    const existing = await prisma.salesAgent.findUnique({ where: { id } });
    if (!existing) throw new Error('Sales agent not found');
    if (existing.isHouse && data.active === false) throw new Error('The company code cannot be deactivated');
    if (existing.isHouse && earnsCommission(data)) throw new Error('The company code earns no commission');
    if (data.packRates) await assertPacksExist(data.packRates);

    // packRates replaces the whole list when sent.
    const { packRates, ...fields } = data;
    const agentData = { ...fields, ...(packRates !== undefined && { packRates: { set: packRates } }) };

    // The login account shows the agent's name (e.g. in the /agent header), so keep it in sync.
    // A linked school account keeps its own name.
    const linkedOwner =
        existing.userId && data.name !== undefined
            ? ((await prisma.user.findUnique({ where: { id: existing.userId } }))?.role ?? 'SALES_AGENT') !== 'SALES_AGENT'
            : false;
    const userData = {
        ...(data.name !== undefined && !linkedOwner && { name: data.name }),
        ...(data.phone !== undefined && { gsm: data.phone }),
    };
    const userId = existing.userId;

    const { userId: _userId, ...updated } =
        userId && Object.keys(userData).length > 0
            ? await prisma.$transaction(async (tx) => {
                  const agent = await tx.salesAgent.update({ where: { id }, data: agentData });
                  await tx.user.update({ where: { id: userId }, data: userData });
                  return agent;
              })
            : await prisma.salesAgent.update({ where: { id }, data: agentData });
    return updated;
};

// One row per active pack with the rate the agent would get on each period (exception or base rate).
const buildRateTable = async (agent: RateSource) => {
    const packs = await prisma.pack.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, code: true, institutionTypes: true, monthlyPrice: true, yearlyPrice: true },
    });
    const perPeriod = <T>(compute: (period: PeriodValue) => T) =>
        Object.fromEntries(PERIODS.map((period) => [period, compute(period)])) as Record<PeriodValue, T>;
    const rows = packs.map((pack) => ({
        packId: pack.id,
        packName: pack.name,
        packCode: pack.code,
        institutionTypes: pack.institutionTypes,
        monthlyPrice: pack.monthlyPrice,
        yearlyPrice: pack.yearlyPrice,
        rates: perPeriod((period) => resolveCommissionRate(agent, pack.id, period)),
        exceptions: perPeriod((period) => agent.packRates.some((rate) => rate.packId === pack.id && rate.period === period)),
    }));
    // Grouped by institution type (first type of the pack) so the display order is stable; sortOrder kept within a type.
    const typeOrder = (row: (typeof rows)[number]) => row.institutionTypes[0] ?? '';
    return rows
        .map((row, index) => ({ row, index }))
        .sort((a, b) => typeOrder(a.row).localeCompare(typeOrder(b.row)) || a.index - b.index)
        .map(({ row }) => row);
};

const NO_ALLOCATION: Allocation = { payoutStatus: 'NONE', paidAmount: 0 };

const reportFor = async (where: Prisma.SalesAgentWhereUniqueInput) => {
    const agent = await prisma.salesAgent.findUnique({
        where,
        include: {
            user: { select: { email: true, avatar: true } },
            schools: {
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    city: true,
                    institutionType: true,
                    status: true,
                    createdAt: true,
                    ownerName: true,
                    ownerPhone: true,
                    pack: { select: { name: true } },
                },
            },
            // Payments credited to this agent (frozen on the payment), not payments of its current schools.
            payments: {
                orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
                select: {
                    id: true,
                    schoolId: true,
                    paidAt: true,
                    createdAt: true,
                    amount: true,
                    period: true,
                    packName: true,
                    commissionRate: true,
                    commissionAmount: true,
                    school: { select: { name: true } },
                },
            },
            payouts: { orderBy: { paidAt: 'desc' }, select: { id: true, paidAt: true, amount: true, note: true } },
        },
    });
    if (!agent) throw new Error('Sales agent not found');

    const labels = await packLabels([agent.packRates]);
    const rateTable = await buildRateTable(agent);
    const totals = buildTotals(agent.schools, agent.payments, agent.payouts);
    const allocation = allocatePayouts(agent.payments, totals.totalPayouts);
    const schools = agent.schools.map(({ pack, ...school }) => {
        // Only payments credited to this agent count.
        const credited = agent.payments.filter((payment) => payment.schoolId === school.id);
        const times = credited.map((payment) => payment.paidAt.getTime());
        const latest = credited.reduce<(typeof credited)[number] | null>(
            (best, payment) => (!best || payment.paidAt.getTime() > best.paidAt.getTime() ? payment : best),
            null
        );
        return {
            ...school,
            packName: pack?.name ?? null,
            firstPaidAt: credited.length ? new Date(Math.min(...times)) : null,
            lastPaidAt: latest?.paidAt ?? null,
            lastPeriod: latest?.period ?? null,
            paymentsCount: credited.length,
            clientStatus: clientStatus(school.status, credited.length),
            totalPaid: sum(credited.map((payment) => payment.amount)),
        };
    });

    return {
        agent: {
            id: agent.id,
            name: agent.name,
            phone: agent.phone,
            code: agent.code,
            monthlyRate: agent.monthlyRate,
            semiannualRate: agent.semiannualRate,
            yearlyRate: agent.yearlyRate,
            packRates: withPackNames(agent.packRates, labels),
            isHouse: agent.isHouse,
            active: agent.active,
            email: agent.user?.email ?? null,
            avatar: agent.user?.avatar ?? null,
            referralPath: `/signup?ref=${agent.code}`,
            payoutMethod: agent.payoutMethod,
            bankName: agent.bankName,
            rib: agent.rib,
            accountHolder: agent.accountHolder,
            payoutPhone: agent.payoutPhone,
            walletProvider: agent.walletProvider,
        },
        rateTable,
        totals: { ...totals, statusCounts: countStatuses(schools.map((school) => school.clientStatus)) },
        schools,
        commissions: agent.payments.map(({ school, createdAt: _createdAt, ...payment }) => ({
            ...payment,
            schoolName: school.name,
            ...(allocation.get(payment.id) ?? NO_ALLOCATION),
        })),
        payouts: agent.payouts,
    };
};

export const getAgentReport = (id: string) => {
    assertId('Sales agent id', id);
    return reportFor({ id });
};

// The agent linked to a login account (any role), or null.
export const findAgentByUserId = async (userId: string) => {
    assertId('User id', userId);
    return prisma.salesAgent.findUnique({ where: { userId } });
};

export const getAgentReportForUser = (userId: string) => {
    assertId('User id', userId);
    return reportFor({ userId });
};

export const recordPayout = async (agentId: string, input: Record<string, unknown>) => {
    assertId('Sales agent id', agentId);
    const data = sanitizePayout(input);
    const agent = await prisma.salesAgent.findUnique({ where: { id: agentId } });
    if (!agent) throw new Error('Sales agent not found');
    return prisma.agentPayout.create({ data: { ...data, salesAgentId: agentId } });
};

export const deletePayout = async (agentId: string, payoutId: string) => {
    assertId('Sales agent id', agentId);
    assertId('Payout id', payoutId);
    const payout = await prisma.agentPayout.findFirst({ where: { id: payoutId, salesAgentId: agentId } });
    if (!payout) throw new Error('Payout not found');
    await prisma.agentPayout.delete({ where: { id: payoutId } });
    return { id: payoutId };
};

// The agent edits their own phone, photo and payout method. The phone and the photo live on the login account.
export const updateOwnProfile = async (userId: string, input: Record<string, unknown>) => {
    assertId('User id', userId);
    const data = sanitizeAgentSelfUpdate(input);
    const agent = await prisma.salesAgent.findUnique({ where: { userId } });
    if (!agent) throw new Error('Sales agent not found');

    const { userId: _userId, ...updated } = await prisma.$transaction(async (tx) => {
        const { avatar, ...agentData } = data;
        const result = await tx.salesAgent.update({ where: { id: agent.id }, data: agentData });
        const userData: { gsm?: string | null; avatar?: string | null } = {};
        if (data.phone !== undefined) userData.gsm = data.phone;
        if (avatar !== undefined) userData.avatar = avatar;
        if (Object.keys(userData).length > 0) await tx.user.update({ where: { id: userId }, data: userData });
        return result;
    });
    return updated;
};

export const changeOwnPassword = async (userId: string, input: Record<string, unknown>) => {
    assertId('User id', userId);
    const newPassword = sanitizeNewPassword(input.newPassword);
    const currentPassword = typeof input.currentPassword === 'string' ? input.currentPassword : '';
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (!(await comparePassword(currentPassword, user.password))) throw new Error('Current password is incorrect');
    await prisma.user.update({ where: { id: userId }, data: { password: await hashPassword(newPassword) } });
    return { changed: true };
};

// A linked school account (OWNER...) keeps its own credentials: they are not managed from the agent screen.
const assertAgentOwnsLogin = async (userId: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user && user.role !== 'SALES_AGENT') {
        throw new Error('This account is also a school account: change its email/password from its own profile');
    }
};

// Super admin sets a new password on the agent's login account. The house agent has no login.
export const resetAgentPassword = async (agentId: string, input: Record<string, unknown>) => {
    assertId('Sales agent id', agentId);
    const newPassword = sanitizeNewPassword(input.newPassword);
    const agent = await prisma.salesAgent.findUnique({ where: { id: agentId } });
    if (!agent) throw new Error('Sales agent not found');
    if (agent.isHouse || !agent.userId) throw new Error('The company code has no login');
    await assertAgentOwnsLogin(agent.userId);
    await prisma.user.update({ where: { id: agent.userId }, data: { password: await hashPassword(newPassword) } });
    return { changed: true };
};

// Super admin changes the email the agent logs in with. The house agent has no login.
export const changeAgentEmail = async (agentId: string, input: Record<string, unknown>) => {
    assertId('Sales agent id', agentId);
    const email = sanitizeEmail(input.email);
    const agent = await prisma.salesAgent.findUnique({ where: { id: agentId } });
    if (!agent) throw new Error('Sales agent not found');
    if (agent.isHouse || !agent.userId) throw new Error('The company code has no login');
    await assertAgentOwnsLogin(agent.userId);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== agent.userId) throw new Error('Email already exists');
    try {
        const updated = await prisma.user.update({ where: { id: agent.userId }, data: { email }, select: { email: true } });
        return { email: updated.email };
    } catch (error) {
        if ((error as { code?: string })?.code === 'P2002') throw new Error('Email already exists');
        throw error;
    }
};
