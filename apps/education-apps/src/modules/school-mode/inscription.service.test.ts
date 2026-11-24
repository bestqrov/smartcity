// src/modules/school-mode/inscription.service.test.ts
import prisma from '../../config/database';
import { assertStudentCapacity } from '../packs/packs.limits';
import { createSubscription } from '../transport/subscriptions.service';
import { branchHasFeature } from '../packs/packFeatures';
import { registerSchoolStudent, splitPaid } from './inscription.service';

jest.mock('../packs/packs.limits', () => ({ assertStudentCapacity: jest.fn() }));
jest.mock('../transport/subscriptions.service', () => ({ createSubscription: jest.fn() }));
jest.mock('../packs/packFeatures', () => ({ branchHasFeature: jest.fn().mockResolvedValue(true) }));
jest.mock('../../config/database', () => {
    const tx = {
        parent: { findFirst: jest.fn(), create: jest.fn() },
        student: { create: jest.fn(), findFirst: jest.fn() },
        inscription: { create: jest.fn() },
        payment: { create: jest.fn() },
        transaction: { create: jest.fn() },
    };
    return {
        __esModule: true,
        default: {
            settings: { findUnique: jest.fn() },
            tuitionFee: { findUnique: jest.fn() },
            student: { findFirst: jest.fn() },
            group: { findFirst: jest.fn() },
            $transaction: jest.fn((cb: any) => cb(tx)),
            __tx: tx,
        },
    };
});
const db = prisma as any;
const tx = db.__tx;
const NOW = new Date('2026-11-24T10:00:00Z');

const base = {
    name: 'Lina', surname: 'Sqalli', nameAr: 'لينا', surnameAr: 'الصقلي', gender: 'F', birthDate: '2021-04-02',
    level: 'PS2', parentName: 'Mohamed Sqalli', parentRelation: 'Père', parentPhone: '06 12 34 56 78',
    amountPaid: 1250, method: 'CASH',
};

beforeEach(() => {
    jest.clearAllMocks();
    db.settings.findUnique.mockResolvedValue({ schoolCycles: ['PRESCOLAIRE', 'PRIMAIRE'], schoolYear: null });
    db.tuitionFee.findUnique.mockResolvedValue({ inscriptionFee: 500, monthlyFee: 600, insuranceFee: 150 });
    db.student.findFirst.mockResolvedValue(null);
    tx.parent.findFirst.mockResolvedValue(null);
    tx.student.findFirst.mockResolvedValue(null);
    tx.parent.create.mockResolvedValue({ id: 'par1' });
    tx.student.create.mockImplementation(({ data }: any) => ({ id: 'stu1', ...data }));
    tx.payment.create.mockImplementation(({ data }: any) => ({ id: `pay-${data.forMonth ?? 'fees'}`, ...data }));
});

describe('splitPaid', () => {
    it('pays the fees first, then the first month, and refuses more', () => {
        expect(splitPaid(1250, 650, 600)).toEqual({ fees: 650, firstMonth: 600 });
        expect(splitPaid(400, 650, 600)).toEqual({ fees: 400, firstMonth: 0 });
        expect(splitPaid(0, 650, 600)).toEqual({ fees: 0, firstMonth: 0 });
        expect(() => splitPaid(1300, 650, 600)).toThrow('Mensualités');
        expect(splitPaid(0.1 + 0.2, 0.1, 0.2)).toEqual({ fees: 0.1, firstMonth: 0.2 });
    });
});

describe('registerSchoolStudent', () => {
    it('creates student, parent, a SCOLARITE inscription and the two payments', async () => {
        const result = await registerSchoolStudent('b1', base, NOW);

        expect(assertStudentCapacity).toHaveBeenCalledWith('b1', 1);
        expect(tx.parent.create.mock.calls[0][0].data).toMatchObject({ name: 'Mohamed Sqalli', phone: '0612345678', branchId: 'b1' });
        const student = tx.student.create.mock.calls[0][0].data;
        expect(student).toMatchObject({ tuitionStartMonth: '2026-11', schoolLevel: 'PS2', schoolYear: '2026/2027', monthlyFee: 600, parentId: 'par1', parentPhone: '0612345678', nameAr: 'لينا', gender: 'F' });
        expect(tx.inscription.create.mock.calls[0][0].data).toMatchObject({ type: 'SCOLARITE', category: 'PS2', amount: 650, note: 'Inscription 2026/2027' });
        expect(tx.payment.create.mock.calls.map((c: any) => [c[0].data.amount, c[0].data.forMonth ?? null])).toEqual([[650, null], [600, '2026-11']]);
        expect(tx.transaction.create.mock.calls.map((c: any) => [c[0].data.type, c[0].data.amount])).toEqual([['INCOME', 650], ['INCOME', 600]]);
        expect(result.summary).toEqual({ inscriptionFee: 500, insuranceFee: 150, monthlyFee: 600, firstDue: 1250, paid: 1250, remaining: 0, startMonth: '2026-11' });
    });

    it('applies the sibling discount to the monthly fee and freezes it', async () => {
        await registerSchoolStudent('b1', { ...base, siblingDiscount: 10, amountPaid: 0 }, NOW);
        expect(tx.student.create.mock.calls[0][0].data).toMatchObject({ monthlyFee: 540, siblingDiscount: 10 });
        expect(tx.inscription.create.mock.calls[0][0].data.amount).toBe(650);
        expect(tx.payment.create).not.toHaveBeenCalled();
    });

    it('uses the office overrides and the existing parent', async () => {
        tx.parent.findFirst.mockResolvedValue({ id: 'parX' });
        await registerSchoolStudent('b1', { ...base, fees: { inscriptionFee: 0, monthlyFee: 700, insuranceFee: 0 }, amountPaid: 700 }, NOW);
        expect(tx.parent.create).not.toHaveBeenCalled();
        expect(tx.student.create.mock.calls[0][0].data).toMatchObject({ parentId: 'parX', monthlyFee: 700 });
        expect(tx.payment.create.mock.calls.map((c: any) => c[0].data.forMonth)).toEqual(['2026-11']);
    });

    it('subscribes to transport when asked', async () => {
        const result = await registerSchoolStudent('b1', { ...base, transport: { routeId: 'aaaaaaaaaaaaaaaaaaaaaaaa', stopId: 'bbbbbbbbbbbbbbbbbbbbbbbb' } }, NOW);
        expect(createSubscription).toHaveBeenCalledWith(expect.objectContaining({ studentId: 'stu1', branchId: 'b1', routeId: 'aaaaaaaaaaaaaaaaaaaaaaaa' }));
        expect(result).not.toHaveProperty('transportError');
    });

    it('keeps the inscription when transport fails and reports why', async () => {
        (createSubscription as jest.Mock).mockRejectedValueOnce(new Error('Plus de place dans ce bus'));
        const result = await registerSchoolStudent('b1', { ...base, transport: { routeId: 'aaaaaaaaaaaaaaaaaaaaaaaa', stopId: 'bbbbbbbbbbbbbbbbbbbbbbbb' } }, NOW);
        expect(result.student.id).toBe('stu1');
        expect(result.transportError).toBe('Plus de place dans ce bus');
    });

    it('starts tuition in September for a summer inscription', async () => {
        await registerSchoolStudent('b1', { ...base, amountPaid: 0 }, new Date('2026-07-15T10:00:00Z'));
        expect(tx.student.create.mock.calls[0][0].data.tuitionStartMonth).toBe('2026-09');
    });

    it('accepts a group of the branch and refuses another', async () => {
        const gid = 'cccccccccccccccccccccccc';
        db.group.findFirst.mockResolvedValue({ id: gid });
        await registerSchoolStudent('b1', { ...base, groupId: gid }, NOW);
        expect(db.group.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: gid, branchId: 'b1' } }));
        expect(tx.student.create.mock.calls[0][0].data.groupIds).toEqual([gid]);
        db.group.findFirst.mockResolvedValue(null);
        await expect(registerSchoolStudent('b1', { ...base, groupId: gid }, NOW)).rejects.toThrow('Groupe introuvable');
        await expect(registerSchoolStudent('b1', { ...base, groupId: 'bad' }, NOW)).rejects.toThrow('Groupe introuvable');
    });

    it('cleans blood group and authorized pickup', async () => {
        await registerSchoolStudent('b1', { ...base, bloodGroup: ' ab+ ', authorizedPickup: [' Oncle Karim ', '', '  ', 3] }, NOW);
        expect(tx.student.create.mock.calls[0][0].data).toMatchObject({ bloodGroup: 'AB+', authorizedPickup: ['Oncle Karim'] });
        jest.clearAllMocks();
        await registerSchoolStudent('b1', { ...base, bloodGroup: '  ' }, NOW);
        expect(tx.student.create.mock.calls[0][0].data.bloodGroup).toBeUndefined();
    });

    it('refuses bad input before writing anything', async () => {
        await expect(registerSchoolStudent('b1', { ...base, name: ' ' }, NOW)).rejects.toThrow('Le prénom');
        await expect(registerSchoolStudent('b1', { ...base, level: 'C1' }, NOW)).rejects.toThrow('niveau');
        await expect(registerSchoolStudent('b1', { ...base, gender: 'X' }, NOW)).rejects.toThrow('sexe');
        await expect(registerSchoolStudent('b1', { ...base, massarNumber: '123' }, NOW)).rejects.toThrow('Massar');
        await expect(registerSchoolStudent('b1', { ...base, birthDate: 'pas une date' }, NOW)).rejects.toThrow('Date de naissance');
        await expect(registerSchoolStudent('b1', { ...base, method: 'BITCOIN' }, NOW)).rejects.toThrow('Mode de paiement');
        await expect(registerSchoolStudent('b1', { ...base, bloodGroup: 'Z+' }, NOW)).rejects.toThrow('Groupe sanguin');
        db.student.findFirst.mockResolvedValue({ name: 'Adam', surname: 'Bennani' });
        await expect(registerSchoolStudent('b1', { ...base, massarNumber: 'J130000001' }, NOW)).rejects.toThrow('Adam Bennani');
        // inactive students keep their Massar code too
        expect(db.student.findFirst.mock.calls.at(-1)[0].where).toEqual({ branchId: 'b1', massarNumber: 'J130000001' });
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('reports transport not in the pack and creates no subscription', async () => {
        (branchHasFeature as jest.Mock).mockResolvedValueOnce(false);
        const result = await registerSchoolStudent('b1', { ...base, transport: { routeId: 'aaaaaaaaaaaaaaaaaaaaaaaa', stopId: 'bbbbbbbbbbbbbbbbbbbbbbbb' } }, NOW);
        expect(result.transportError).toBe("Le transport n'est pas inclus dans le pack");
        expect(createSubscription).not.toHaveBeenCalled();
        expect(tx.student.create).toHaveBeenCalled();
    });

    it('checks the Massar code again inside the transaction', async () => {
        tx.student.findFirst.mockResolvedValue({ name: 'Adam', surname: 'Bennani' });
        await expect(registerSchoolStudent('b1', { ...base, massarNumber: 'A123456789' }, NOW)).rejects.toThrow('Adam Bennani');
        expect(db.student.findFirst).toHaveBeenCalled();
        expect(tx.student.create).not.toHaveBeenCalled();
    });
});
