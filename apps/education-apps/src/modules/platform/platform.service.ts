import prisma from '../../config/database';
import { roundMoney } from '../sales-agents/salesAgents.validation';
import { buildTotals } from '../sales-agents/salesAgents.service';
import { UNSETTLED } from '../subscription/packUpgrade.service';

// Raw data of the super admin platform dashboard, in one call. Aggregation happens in the browser,
// like the sales agent dashboard. Every query uses an explicit `select` and the results are mapped
// field by field, so no password hash, user id, owner contact or bank detail can reach the response.
export const getPlatformOverview = async () => {
    const [schools, payments, agents, payouts, upgrades] = await Promise.all([
        prisma.school.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                city: true,
                institutionType: true,
                status: true,
                createdAt: true,
                trialEndsAt: true,
                partnerOffer: true,
                offerPeriod: true,
                offerPrice: true,
                pack: { select: { name: true } },
                salesAgent: { select: { id: true, name: true, code: true } },
            },
        }),
        prisma.schoolPayment.findMany({
            orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
            select: {
                id: true,
                schoolId: true,
                amount: true,
                period: true,
                paidAt: true,
                packName: true,
                salesAgentId: true,
                commissionAmount: true,
                school: { select: { name: true } },
                salesAgent: { select: { name: true } },
            },
        }),
        prisma.salesAgent.findMany({
            orderBy: [{ isHouse: 'desc' }, { createdAt: 'asc' }],
            select: {
                id: true,
                name: true,
                code: true,
                isHouse: true,
                active: true,
                user: { select: { avatar: true } },
                schools: { select: { status: true } },
                payments: { select: { commissionAmount: true } },
                payouts: { select: { amount: true } },
            },
        }),
        prisma.agentPayout.findMany({
            orderBy: { paidAt: 'desc' },
            select: { salesAgentId: true, amount: true, paidAt: true },
        }),
        prisma.packUpgrade.findMany({
            where: { dueAt: { not: null }, ...UNSETTLED },
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
        }),
    ]);

    // Per school: everything it paid, whoever was credited.
    const paidBySchool = new Map<string, { total: number; last: Date | null }>();
    for (const payment of payments) {
        const entry = paidBySchool.get(payment.schoolId) ?? { total: 0, last: null };
        entry.total += payment.amount;
        if (!entry.last || payment.paidAt.getTime() > entry.last.getTime()) entry.last = payment.paidAt;
        paidBySchool.set(payment.schoolId, entry);
    }

    return {
        schools: schools.map((school) => ({
            id: school.id,
            name: school.name,
            city: school.city,
            institutionType: school.institutionType,
            status: school.status,
            packName: school.pack?.name ?? null,
            partnerOffer: school.partnerOffer,
            offerPeriod: school.offerPeriod,
            offerPrice: school.offerPrice,
            salesAgent: school.salesAgent ? { id: school.salesAgent.id, name: school.salesAgent.name, code: school.salesAgent.code } : null,
            createdAt: school.createdAt,
            trialEndsAt: school.trialEndsAt,
            totalPaid: roundMoney(paidBySchool.get(school.id)?.total ?? 0),
            lastPaidAt: paidBySchool.get(school.id)?.last ?? null,
        })),
        payments: payments.map((payment) => ({
            id: payment.id,
            schoolId: payment.schoolId,
            schoolName: payment.school.name,
            amount: payment.amount,
            period: payment.period,
            paidAt: payment.paidAt,
            packName: payment.packName,
            salesAgentId: payment.salesAgentId,
            salesAgentName: payment.salesAgent?.name ?? null,
            commissionAmount: payment.commissionAmount,
        })),
        agents: agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            code: agent.code,
            isHouse: agent.isHouse,
            active: agent.active,
            avatar: agent.user?.avatar ?? null,
            totals: buildTotals(agent.schools, agent.payments, agent.payouts),
        })),
        payouts: payouts.map((payout) => ({ agentId: payout.salesAgentId, amount: payout.amount, paidAt: payout.paidAt })),
        pendingUpgrades: upgrades.map((upgrade) => ({
            id: upgrade.id,
            schoolId: upgrade.schoolId,
            schoolName: upgrade.school.name,
            fromPackName: upgrade.fromPackName,
            toPackName: upgrade.toPackName,
            toMonthlyPrice: upgrade.toMonthlyPrice,
            createdAt: upgrade.createdAt,
            dueAt: upgrade.dueAt,
        })),
    };
};
