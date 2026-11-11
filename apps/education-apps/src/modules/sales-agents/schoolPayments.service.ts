import prisma from '../../config/database';
import { assertId } from '../transport/ids';
import { computeCommission, sanitizePayment } from './salesAgents.validation';

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

// An inactive agent still earns: deactivation only stops new signups with the code.
export const recordSchoolPayment = async (schoolId: string, input: Record<string, unknown>) => {
    assertId('School id', schoolId);
    const data = sanitizePayment(input);

    return prisma.$transaction(async (tx) => {
        const school = await tx.school.findUnique({ where: { id: schoolId }, include: { salesAgent: true } });
        if (!school) throw new Error('School not found');

        const rate = school.salesAgent?.commissionRate ?? 0;
        return tx.schoolPayment.create({
            data: {
                ...data,
                schoolId,
                salesAgentId: school.salesAgent?.id ?? null,
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
