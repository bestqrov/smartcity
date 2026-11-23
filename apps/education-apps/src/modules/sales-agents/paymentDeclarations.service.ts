import prisma from '../../config/database';
import { assertId } from '../transport/ids';
import { recordSchoolPayment } from './schoolPayments.service';
import { sanitizePayment } from './salesAgents.validation';

// A sales agent reports a client school's payment with its proof; the super admin confirms it (the payment
// is recorded, the commission computed and the school activated) or rejects it with a reason.

export const DECLARATION_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_MONEY'] as const;
const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
// ~5 MB file once base64-encoded (4/3 of the bytes).
export const MAX_PROOF_LENGTH = 7_000_000;
const MAX_REASON = 500;

const parseProof = (value: unknown): string => {
    if (typeof value !== 'string' || !value) throw new Error('A proof of payment is required');
    const match = value.match(/^data:([\w/+.-]+);base64,/);
    if (!match || !PROOF_TYPES.includes(match[1])) throw new Error('The proof must be an image (JPG, PNG, WEBP) or a PDF');
    if (value.length > MAX_PROOF_LENGTH) throw new Error('The proof is too large (5 MB max)');
    return value;
};

const optionalName = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : null;

// The list views leave the proof out (it can weigh megabytes); it is fetched with one declaration.
const LIST_SELECT = {
    id: true,
    schoolId: true,
    salesAgentId: true,
    amount: true,
    period: true,
    paidAt: true,
    method: true,
    note: true,
    proofName: true,
    status: true,
    rejectReason: true,
    reviewedAt: true,
    createdAt: true,
    school: { select: { id: true, name: true, city: true, status: true, pack: { select: { name: true } } } },
    salesAgent: { select: { id: true, name: true, code: true } },
} as const;

export const declarePayment = async (salesAgentId: string, input: Record<string, unknown>) => {
    assertId('School id', input.schoolId);
    const payment = sanitizePayment(input);
    if (payment.paidAt.getTime() > Date.now() + 86_400_000) throw new Error('The payment date cannot be in the future');
    const method = DECLARATION_METHODS.find((m) => m === input.method);
    if (!method) throw new Error('method must be CASH, BANK_TRANSFER, CHEQUE or MOBILE_MONEY');
    const proof = parseProof(input.proof);

    // An agent only declares payments for their own clients.
    const school = await prisma.school.findFirst({ where: { id: input.schoolId as string, salesAgentId }, select: { id: true } });
    if (!school) throw new Error('School not found');

    return prisma.paymentDeclaration.create({
        data: {
            schoolId: school.id,
            salesAgentId,
            amount: payment.amount,
            period: payment.period,
            paidAt: payment.paidAt,
            note: payment.note ?? null,
            method,
            proof,
            proofName: optionalName(input.proofName),
        },
        select: LIST_SELECT,
    });
};

export const listAgentDeclarations = (salesAgentId: string) =>
    prisma.paymentDeclaration.findMany({ where: { salesAgentId }, orderBy: { createdAt: 'desc' }, select: LIST_SELECT });

const STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED'] as const;

export const listDeclarations = (status?: unknown) => {
    const filter = STATUSES.find((s) => s === status);
    return prisma.paymentDeclaration.findMany({
        where: filter ? { status: filter } : {},
        // Pending first (oldest waiting longest on top), then the latest decisions.
        orderBy: filter === 'PENDING' ? { createdAt: 'asc' } : { createdAt: 'desc' },
        select: LIST_SELECT,
        take: 200,
    });
};

export const countPendingDeclarations = () => prisma.paymentDeclaration.count({ where: { status: 'PENDING' } });

export const getDeclaration = async (id: string) => {
    assertId('Declaration id', id);
    const declaration = await prisma.paymentDeclaration.findUnique({ where: { id }, select: { ...LIST_SELECT, proof: true } });
    if (!declaration) throw new Error('Declaration not found');
    return declaration;
};

// The super admin may correct the amount, period or date read on the proof before confirming.
export const confirmDeclaration = async (id: string, reviewerId: string, overrides: Record<string, unknown> = {}) => {
    assertId('Declaration id', id);
    const declaration = await prisma.paymentDeclaration.findUnique({ where: { id } });
    if (!declaration) throw new Error('Declaration not found');
    if (declaration.status !== 'PENDING') throw new Error('This declaration was already reviewed');

    // Claim it first, so a second click (or a second admin) cannot record the payment twice.
    const claimed = await prisma.paymentDeclaration.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'CONFIRMED', reviewedAt: new Date(), reviewedById: reviewerId },
    });
    if (claimed.count === 0) throw new Error('This declaration was already reviewed');

    const methodLabel: Record<string, string> = { CASH: 'espèces', BANK_TRANSFER: 'virement', CHEQUE: 'chèque', MOBILE_MONEY: 'portefeuille mobile' };
    try {
        const payment = await recordSchoolPayment(declaration.schoolId, {
            amount: overrides.amount ?? declaration.amount,
            period: overrides.period ?? declaration.period,
            paidAt: overrides.paidAt ?? declaration.paidAt.toISOString().slice(0, 10),
            note: [`Déclaré par le commercial (${methodLabel[declaration.method] ?? declaration.method})`, declaration.note].filter(Boolean).join(' — '),
        });
        // A confirmed payment is the super admin's decision to open the school, even a suspended one.
        await prisma.school.update({ where: { id: declaration.schoolId }, data: { status: 'ACTIVE' } });
        return prisma.paymentDeclaration.update({
            where: { id },
            data: { schoolPaymentId: payment.id, amount: payment.amount, period: payment.period, paidAt: payment.paidAt },
            select: LIST_SELECT,
        });
    } catch (error) {
        // Nothing recorded: the declaration goes back to the waiting list.
        await prisma.paymentDeclaration.update({ where: { id }, data: { status: 'PENDING', reviewedAt: null, reviewedById: null } });
        throw error;
    }
};

export const rejectDeclaration = async (id: string, reviewerId: string, reason: unknown) => {
    assertId('Declaration id', id);
    const text = typeof reason === 'string' ? reason.trim() : '';
    if (!text) throw new Error('A reason is required to reject a declaration');
    const updated = await prisma.paymentDeclaration.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'REJECTED', rejectReason: text.slice(0, MAX_REASON), reviewedAt: new Date(), reviewedById: reviewerId },
    });
    if (updated.count === 0) {
        const exists = await prisma.paymentDeclaration.findUnique({ where: { id }, select: { id: true } });
        throw new Error(exists ? 'This declaration was already reviewed' : 'Declaration not found');
    }
    return prisma.paymentDeclaration.findUnique({ where: { id }, select: LIST_SELECT });
};
