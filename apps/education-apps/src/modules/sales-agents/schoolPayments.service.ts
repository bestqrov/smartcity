import prisma from '../../config/database';
import { assertId } from '../transport/ids';
import { UNSETTLED } from '../subscription/packUpgrade.service';
import { computeCommission, resolveCommissionRate, sanitizePayment } from './salesAgents.validation';

// Changing a school's agent only affects payments recorded afterwards: past payments keep their frozen agent.
export const assignSchoolAgent = async (schoolId: string, salesAgentId: unknown) => {
    assertId('School id', schoolId);
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new Error('School not found');

    let agentId: string | null = null;
    if (salesAgentId !== null && salesAgentId !== undefined && salesAgentId !== '') {
        assertId('Sales agent id', salesAgentId);
        const agent = await prisma.salesAgent.findUnique({ where: { id: salesAgentId } });
        if (!agent) throw new Error('Sales agent not found');
        agentId = agent.id;
    }

    return prisma.school.update({
        where: { id: schoolId },
        data: { salesAgentId: agentId },
        select: { id: true, salesAgentId: true },
    });
};

export const listSchoolPayments = async (schoolId: string) => {
    assertId('School id', schoolId);
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new Error('School not found');

    return prisma.schoolPayment.findMany({
        where: { schoolId },
        orderBy: { paidAt: 'desc' },
        include: { salesAgent: { select: { id: true, name: true, code: true } } },
    });
};

// The school's current agent, the rate resolved for (pack, period) and the pack itself are frozen on the
// payment: later changes to the agent's rates, the school's agent or its pack never touch it.
// An inactive agent still earns: deactivation only stops new signups with the code.
export const recordSchoolPayment = async (schoolId: string, input: Record<string, unknown>) => {
    assertId('School id', schoolId);
    const data = sanitizePayment(input);

    return prisma.$transaction(async (tx) => {
        const school = await tx.school.findUnique({
            where: { id: schoolId },
            include: { salesAgent: true, pack: { select: { id: true, name: true } } },
        });
        if (!school) throw new Error('School not found');

        // A school that pays is a customer: a pending signup becomes active. A suspended school stays
        // suspended (reactivating it is a deliberate super admin decision).
        if (school.status === 'PENDING') {
            await tx.school.update({ where: { id: schoolId }, data: { status: 'ACTIVE' } });
        }

        // A payment settles the school's pack upgrades made up to the end of the payment day (paidAt is a
        // date at midnight UTC, the upgrade a timestamp, so an upgrade and its payment the same day match).
        await tx.packUpgrade.updateMany({
            where: {
                schoolId,
                createdAt: { lt: new Date(data.paidAt.getTime() + 86_400_000) },
                ...UNSETTLED,
            },
            data: { settledAt: data.paidAt },
        });

        const packId = school.pack?.id ?? null;
        const rate = resolveCommissionRate(school.salesAgent, packId, data.period);
        return tx.schoolPayment.create({
            data: {
                ...data,
                schoolId,
                salesAgentId: school.salesAgent?.id ?? null,
                packId,
                packName: school.pack?.name ?? null,
                commissionRate: rate,
                commissionAmount: computeCommission(data.amount, rate),
            },
        });
    });
};

export const deleteSchoolPayment = async (schoolId: string, paymentId: string) => {
    assertId('School id', schoolId);
    assertId('Payment id', paymentId);
    const payment = await prisma.schoolPayment.findFirst({ where: { id: paymentId, schoolId } });
    if (!payment) throw new Error('Payment not found');
    await prisma.schoolPayment.delete({ where: { id: paymentId } });
    return { id: paymentId };
};
