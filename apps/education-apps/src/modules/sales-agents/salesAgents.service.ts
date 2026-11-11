import prisma from '../../config/database';
import { hashPassword } from '../../utils/bcrypt';
import { assertId } from '../transport/ids';
import { CODE_PATTERN, normalizeCode, roundMoney, sanitizeAgentUpdate, sanitizeNewAgent } from './salesAgents.validation';

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
        return await prisma.$transaction(async (tx) => {
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

    return prisma.salesAgent.update({ where: { id }, data });
};
