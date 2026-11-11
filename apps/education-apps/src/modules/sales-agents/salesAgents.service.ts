import type { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { hashPassword } from '../../utils/bcrypt';
import { assertId } from '../transport/ids';
import { CODE_PATTERN, normalizeCode, roundMoney, sanitizeAgentUpdate, sanitizeNewAgent, sanitizePayout } from './salesAgents.validation';

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
    } catch {
        return false;
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

export const listAgents = async () => {
    const agents = await prisma.salesAgent.findMany({
        orderBy: [{ isHouse: 'desc' }, { createdAt: 'asc' }],
        include: {
            user: { select: { email: true } },
            schools: { select: { status: true } },
            payments: { select: { commissionAmount: true } },
            payouts: { select: { amount: true } },
        },
    });

    return agents.map(({ user, schools, payments, payouts, userId: _userId, ...agent }) => ({
        ...agent,
        email: user?.email ?? null,
        totals: buildTotals(schools, payments, payouts),
    }));
};

export const createAgent = async (input: Record<string, unknown>) => {
    const data = sanitizeNewAgent(input);

    if (await prisma.salesAgent.findUnique({ where: { code: data.code } })) throw new Error('This code is already used');
    if (await prisma.user.findUnique({ where: { email: data.email } })) throw new Error('Email already exists');

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
                    commissionRate: data.commissionRate,
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

export const updateAgent = async (id: string, input: Record<string, unknown>) => {
    assertId('Sales agent id', id);
    const data = sanitizeAgentUpdate(input);

    const existing = await prisma.salesAgent.findUnique({ where: { id } });
    if (!existing) throw new Error('Sales agent not found');
    if (existing.isHouse && data.active === false) throw new Error('The company code cannot be deactivated');

    const { userId: _userId, ...updated } = await prisma.salesAgent.update({ where: { id }, data });
    return updated;
};

const reportFor = async (where: Prisma.SalesAgentWhereUniqueInput) => {
    const agent = await prisma.salesAgent.findUnique({
        where,
        include: {
            user: { select: { email: true } },
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
                orderBy: { paidAt: 'desc' },
                select: {
                    id: true,
                    schoolId: true,
                    paidAt: true,
                    amount: true,
                    period: true,
                    commissionRate: true,
                    commissionAmount: true,
                    school: { select: { name: true } },
                },
            },
            payouts: { orderBy: { paidAt: 'desc' }, select: { id: true, paidAt: true, amount: true, note: true } },
        },
    });
    if (!agent) throw new Error('Sales agent not found');

    return {
        agent: {
            id: agent.id,
            name: agent.name,
            phone: agent.phone,
            code: agent.code,
            commissionRate: agent.commissionRate,
            isHouse: agent.isHouse,
            active: agent.active,
            email: agent.user?.email ?? null,
            referralPath: `/signup?ref=${agent.code}`,
        },
        totals: buildTotals(agent.schools, agent.payments, agent.payouts),
        schools: agent.schools.map(({ pack, ...school }) => ({
            ...school,
            packName: pack?.name ?? null,
            // Only payments credited to this agent count.
            totalPaid: sum(agent.payments.filter((payment) => payment.schoolId === school.id).map((payment) => payment.amount)),
        })),
        commissions: agent.payments.map(({ school, schoolId: _schoolId, ...payment }) => ({ ...payment, schoolName: school.name })),
        payouts: agent.payouts,
    };
};

export const getAgentReport = (id: string) => {
    assertId('Sales agent id', id);
    return reportFor({ id });
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
