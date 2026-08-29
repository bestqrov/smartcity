import prisma from '../../config/database';
import { regenerateStudentToken, updateStudent, createStudent, getAllStudents, getStudentById } from './students.service';

jest.mock('../../config/database', () => {
    const student = {
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
    };
    const inscription = { create: jest.fn() };
    const payment = { create: jest.fn() };

    return {
        __esModule: true,
        default: {
            student,
            inscription,
            payment,
            $transaction: jest.fn((cb: any) => cb({ student, inscription, payment })),
        },
    };
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
        (prisma.student.update as jest.Mock).mockResolvedValue({ id: 's1', parentId: 'p1' });

        await updateStudent('s1', 'b1', { parentId: 'p1' });

        expect(prisma.student.findFirst).toHaveBeenCalledWith({ where: { id: 's1', branchId: 'b1' } });
        expect(prisma.student.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { parentId: 'p1' },
        });
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
