import prisma from '../../config/database';
import { recordSchoolPayment } from './schoolPayments.service';
import {
    confirmDeclaration,
    declarePayment,
    listDeclarations,
    MAX_PROOF_LENGTH,
    rejectDeclaration,
} from './paymentDeclarations.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        school: { findFirst: jest.fn(), update: jest.fn() },
        paymentDeclaration: {
            create: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
            count: jest.fn(),
        },
    },
}));
jest.mock('./schoolPayments.service', () => ({ recordSchoolPayment: jest.fn() }));

const db = prisma as any;
const SCHOOL = '6ab050b281878c35b0f00752';
const DECL = '6ab050b281878c35b0f00753';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const valid = { schoolId: SCHOOL, amount: 3500, period: 'YEARLY', paidAt: '2026-11-20', method: 'BANK_TRANSFER', proof: PNG, proofName: 'virement.png' };

beforeEach(() => jest.clearAllMocks());

describe('declarePayment', () => {
    it('records a pending declaration for one of the agent\'s schools', async () => {
        db.school.findFirst.mockResolvedValue({ id: SCHOOL });
        db.paymentDeclaration.create.mockResolvedValue({ id: DECL });

        await declarePayment('agent1', valid);

        expect(db.school.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: SCHOOL, salesAgentId: 'agent1' } }));
        const data = db.paymentDeclaration.create.mock.calls[0][0].data;
        expect(data).toMatchObject({ schoolId: SCHOOL, salesAgentId: 'agent1', amount: 3500, period: 'YEARLY', method: 'BANK_TRANSFER', proof: PNG, proofName: 'virement.png' });
        expect(data.status).toBeUndefined(); // PENDING by default
    });

    it("refuses another agent's school", async () => {
        db.school.findFirst.mockResolvedValue(null);
        await expect(declarePayment('agent1', valid)).rejects.toThrow('School not found');
        expect(db.paymentDeclaration.create).not.toHaveBeenCalled();
    });

    it('requires a valid proof, method and date', async () => {
        db.school.findFirst.mockResolvedValue({ id: SCHOOL });
        await expect(declarePayment('agent1', { ...valid, proof: undefined })).rejects.toThrow('A proof of payment is required');
        await expect(declarePayment('agent1', { ...valid, proof: 'data:text/html;base64,PGI+' })).rejects.toThrow('image');
        await expect(declarePayment('agent1', { ...valid, proof: 'data:image/png;base64,' + 'A'.repeat(MAX_PROOF_LENGTH) })).rejects.toThrow('too large');
        await expect(declarePayment('agent1', { ...valid, method: 'BITCOIN' })).rejects.toThrow('method must be');
        await expect(declarePayment('agent1', { ...valid, paidAt: '2099-01-01' })).rejects.toThrow('future');
        await expect(declarePayment('agent1', { ...valid, amount: 0 })).rejects.toThrow();
        expect(db.paymentDeclaration.create).not.toHaveBeenCalled();
    });

    it('accepts a PDF proof', async () => {
        db.school.findFirst.mockResolvedValue({ id: SCHOOL });
        db.paymentDeclaration.create.mockResolvedValue({ id: DECL });
        await declarePayment('agent1', { ...valid, proof: 'data:application/pdf;base64,JVBERi0=' });
        expect(db.paymentDeclaration.create).toHaveBeenCalled();
    });
});

describe('listDeclarations', () => {
    it('lists the pending ones oldest first, without the proof', async () => {
        db.paymentDeclaration.findMany.mockResolvedValue([]);
        await listDeclarations('PENDING');
        const args = db.paymentDeclaration.findMany.mock.calls[0][0];
        expect(args.where).toEqual({ status: 'PENDING' });
        expect(args.orderBy).toEqual({ createdAt: 'asc' });
        expect(args.select.proof).toBeUndefined();
    });
});

describe('confirmDeclaration', () => {
    const pending = { id: DECL, schoolId: SCHOOL, status: 'PENDING', amount: 3500, period: 'YEARLY', paidAt: new Date('2026-11-20T00:00:00Z'), method: 'CASH', note: 'Reçu n°12' };

    it('records the payment (commission computed there), activates the school and links the payment', async () => {
        db.paymentDeclaration.findUnique.mockResolvedValue(pending);
        db.paymentDeclaration.updateMany.mockResolvedValue({ count: 1 });
        (recordSchoolPayment as jest.Mock).mockResolvedValue({ id: 'pay1', amount: 3500, period: 'YEARLY', paidAt: pending.paidAt });

        await confirmDeclaration(DECL, 'admin1');

        expect(db.paymentDeclaration.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: DECL, status: 'PENDING' } }));
        expect(recordSchoolPayment).toHaveBeenCalledWith(SCHOOL, expect.objectContaining({ amount: 3500, period: 'YEARLY', paidAt: '2026-11-20' }));
        expect((recordSchoolPayment as jest.Mock).mock.calls[0][1].note).toContain('Reçu n°12');
        expect(db.school.update).toHaveBeenCalledWith({ where: { id: SCHOOL }, data: { status: 'ACTIVE' } });
        expect(db.paymentDeclaration.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ schoolPaymentId: 'pay1' }) }));
    });

    it('lets the super admin correct the amount', async () => {
        db.paymentDeclaration.findUnique.mockResolvedValue(pending);
        db.paymentDeclaration.updateMany.mockResolvedValue({ count: 1 });
        (recordSchoolPayment as jest.Mock).mockResolvedValue({ id: 'pay1', amount: 3000, period: 'YEARLY', paidAt: pending.paidAt });
        await confirmDeclaration(DECL, 'admin1', { amount: 3000 });
        expect((recordSchoolPayment as jest.Mock).mock.calls[0][1].amount).toBe(3000);
    });

    it('never records twice', async () => {
        db.paymentDeclaration.findUnique.mockResolvedValue({ ...pending, status: 'CONFIRMED' });
        await expect(confirmDeclaration(DECL, 'admin1')).rejects.toThrow('already reviewed');

        db.paymentDeclaration.findUnique.mockResolvedValue(pending);
        db.paymentDeclaration.updateMany.mockResolvedValue({ count: 0 }); // another admin was faster
        await expect(confirmDeclaration(DECL, 'admin1')).rejects.toThrow('already reviewed');
        expect(recordSchoolPayment).not.toHaveBeenCalled();
    });

    it('puts the declaration back in the waiting list when the payment cannot be recorded', async () => {
        db.paymentDeclaration.findUnique.mockResolvedValue(pending);
        db.paymentDeclaration.updateMany.mockResolvedValue({ count: 1 });
        (recordSchoolPayment as jest.Mock).mockRejectedValue(new Error('School not found'));
        await expect(confirmDeclaration(DECL, 'admin1')).rejects.toThrow('School not found');
        expect(db.paymentDeclaration.update).toHaveBeenCalledWith({ where: { id: DECL }, data: { status: 'PENDING', reviewedAt: null, reviewedById: null } });
        expect(db.school.update).not.toHaveBeenCalled();
    });
});

describe('rejectDeclaration', () => {
    it('needs a reason and stores it', async () => {
        await expect(rejectDeclaration(DECL, 'admin1', '  ')).rejects.toThrow('A reason is required');
        db.paymentDeclaration.updateMany.mockResolvedValue({ count: 1 });
        db.paymentDeclaration.findUnique.mockResolvedValue({ id: DECL });
        await rejectDeclaration(DECL, 'admin1', 'Montant illisible sur le reçu');
        expect(db.paymentDeclaration.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: DECL, status: 'PENDING' }, data: expect.objectContaining({ status: 'REJECTED', rejectReason: 'Montant illisible sur le reçu' }) }),
        );
    });

    it('refuses a declaration already reviewed', async () => {
        db.paymentDeclaration.updateMany.mockResolvedValue({ count: 0 });
        db.paymentDeclaration.findUnique.mockResolvedValue({ id: DECL });
        await expect(rejectDeclaration(DECL, 'admin1', 'x')).rejects.toThrow('already reviewed');
    });
});
