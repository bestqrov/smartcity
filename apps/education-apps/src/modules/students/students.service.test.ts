import prisma from '../../config/database';
import { assertStudentCapacity, StudentLimitError } from '../packs/packs.limits';
import { regenerateStudentToken, updateStudent, createStudent, getAllStudents, getStudentById, getStudentByPortalToken } from './students.service';

jest.mock('../../config/database', () => {
    const student = {
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
    };
    const inscription = { create: jest.fn() };
    const parent = { findFirst: jest.fn() };
    const payment = { create: jest.fn() };

    return {
        __esModule: true,
        default: {
            student,
            inscription,
            payment,
            parent,
            $transaction: jest.fn((cb: any) => cb({ student, inscription, payment })),
        },
    };
});

jest.mock('../packs/packs.limits', () => {
    const actual = jest.requireActual('../packs/packs.limits');
    return { ...actual, assertStudentCapacity: jest.fn().mockResolvedValue(undefined) };
});

describe('regenerateStudentToken', () => {
    it('overwrites the stored hash and returns a new raw token', async () => {
        (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 's1' });
        (prisma.student.update as jest.Mock).mockResolvedValue({ id: 's1' });

        const result = await regenerateStudentToken('s1', 'b1');

        expect(prisma.student.findFirst).toHaveBeenCalledWith({ where: { id: 's1', branchId: 'b1' } });
        expect(prisma.student.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { accessTokenHash: expect.any(String) },
        });
        expect(result.rawToken).toEqual(expect.any(String));
    });
});

describe('updateStudent', () => {
    it('forwards parentId to the Prisma update call', async () => {
        (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 's1' });
        (prisma.parent.findFirst as jest.Mock).mockResolvedValue({ id: 'p1', branchId: 'b1' });
        (prisma.student.update as jest.Mock).mockResolvedValue({ id: 's1', parentId: 'p1' });

        await updateStudent('s1', 'b1', { parentId: 'p1' });

        expect(prisma.student.findFirst).toHaveBeenCalledWith({ where: { id: 's1', branchId: 'b1' } });
        expect(prisma.student.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { parentId: 'p1' },
        });
    });

    it('refuses to link a child to another school’s parent', async () => {
        (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 's1' });
        (prisma.parent.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.student.update as jest.Mock).mockClear();

        await expect(updateStudent('s1', 'b1', { parentId: 'p-other' })).rejects.toThrow('Parent not found');
        expect(prisma.parent.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'p-other', branchId: 'b1' } })
        );
        expect(prisma.student.update).not.toHaveBeenCalled();
    });
});

describe('branch scoping', () => {
    it('createStudent sets branchId from the passed-in value', async () => {
        (prisma.student.create as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b1' });

        await createStudent({ name: 'A', surname: 'B', branchId: 'b1' } as any);

        expect(prisma.student.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ branchId: 'b1' }),
            })
        );
    });

    it('getAllStudents only returns students in the given branch', async () => {
        (prisma.student.findMany as jest.Mock).mockResolvedValue([]);

        await getAllStudents('b1');

        expect(prisma.student.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1' } })
        );
    });

    it('getStudentById throws for a student outside the given branch', async () => {
        (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(getStudentById('s1', 'b1')).rejects.toThrow('Student not found');

        expect(prisma.student.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 's1', branchId: 'b1' } })
        );
    });
});

describe('tuition-only payments', () => {
    afterEach(() => jest.clearAllMocks());

    it('getStudentById excludes transport payments from the embedded payments', async () => {
        (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 's1' });

        await getStudentById('s1', 'b1');

        expect(prisma.student.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                include: expect.objectContaining({ payments: { where: { OR: [{ transportSubscriptionId: null }, { transportSubscriptionId: { isSet: false } }] } } }),
            })
        );
    });

    it('getStudentByPortalToken excludes transport payments from the embedded payments', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);

        await getStudentByPortalToken('raw');

        expect(prisma.student.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                include: expect.objectContaining({ payments: { where: { OR: [{ transportSubscriptionId: null }, { transportSubscriptionId: { isSet: false } }] } } }),
            })
        );
    });
});

describe('crèche fields passthrough', () => {
    afterEach(() => jest.clearAllMocks());

    it('createStudent passes crèche fields through when given', async () => {
        (prisma.student.create as jest.Mock).mockResolvedValue({ id: 's1' });

        await createStudent({
            branchId: 'b1',
            name: 'A',
            surname: 'B',
            crecheSection: 'GRANDE',
            healthNotes: 'Allergie arachides',
            authorizedPickup: [{ name: 'Tata', phone: '0600000000', relation: 'Tante' }],
            massarNumber: 'M123456',
        } as any);

        expect(prisma.student.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    crecheSection: 'GRANDE',
                    healthNotes: 'Allergie arachides',
                    authorizedPickup: [{ name: 'Tata', phone: '0600000000', relation: 'Tante' }],
                    massarNumber: 'M123456',
                }),
            })
        );
    });

    it('createStudent omits crèche fields from the record when not given', async () => {
        (prisma.student.create as jest.Mock).mockResolvedValue({ id: 's1' });

        await createStudent({ branchId: 'b1', name: 'A', surname: 'B' } as any);

        const data = (prisma.student.create as jest.Mock).mock.calls[0][0].data;
        expect(data.crecheSection).toBeUndefined();
        expect(data.healthNotes).toBeUndefined();
        expect(data.authorizedPickup).toBeUndefined();
        expect(data.massarNumber).toBeUndefined();
    });

    it('updateStudent passes crèche fields through when given', async () => {
        (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 's1' });
        (prisma.student.update as jest.Mock).mockResolvedValue({ id: 's1' });

        await updateStudent('s1', 'b1', { crecheSection: 'MOYENNE', healthNotes: 'RAS' } as any);

        expect(prisma.student.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { crecheSection: 'MOYENNE', healthNotes: 'RAS' },
        });
    });
});

describe('initial inscription', () => {
    afterEach(() => jest.clearAllMocks());

    it('records the first month owed even when there is no registration fee', async () => {
        (prisma.student.create as jest.Mock).mockResolvedValue({ id: 's1' });

        await createStudent({ branchId: 'b1', name: 'A', surname: 'B', schoolLevel: 'Crèche', subjectsTotal: 800 } as any);

        expect(prisma.inscription.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ amount: 800, category: 'Crèche' }) })
        );
    });

    it('creates no inscription when nothing is owed', async () => {
        (prisma.student.create as jest.Mock).mockResolvedValue({ id: 's1' });

        await createStudent({ branchId: 'b1', name: 'A', surname: 'B' } as any);

        expect(prisma.inscription.create).not.toHaveBeenCalled();
    });
});

describe('createStudent pack limit', () => {
    it('checks room for one student in the branch before creating anything', async () => {
        (prisma.student.create as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b1' });
        await createStudent({ name: 'A', surname: 'B', branchId: 'b1' } as any);
        expect(assertStudentCapacity).toHaveBeenCalledWith('b1', 1);
    });

    it('creates nothing when the school is full', async () => {
        (prisma.student.create as jest.Mock).mockClear();
        (assertStudentCapacity as jest.Mock).mockRejectedValueOnce(
            new StudentLimitError({ limit: 100, current: 100, adding: 1, packName: 'Essentiel' })
        );

        await expect(createStudent({ name: 'A', surname: 'B', branchId: 'b1' } as any)).rejects.toBeInstanceOf(StudentLimitError);
        expect(prisma.student.create).not.toHaveBeenCalled();
    });
});
