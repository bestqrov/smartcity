import prisma from '../../config/database';
import { getStudentsForDocuments, getStudentDocument } from './documents.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: { student: { findMany: jest.fn(), findFirst: jest.fn() } },
}));

const tuitionPayments = { where: { OR: [{ transportSubscriptionId: null }, { transportSubscriptionId: { isSet: false } }] }, orderBy: { date: 'desc' } };

describe('documents service — branch scoping and tuition-only payments', () => {
    afterEach(() => jest.clearAllMocks());

    it('getStudentsForDocuments only returns students of the given branch', async () => {
        (prisma.student.findMany as jest.Mock).mockResolvedValue([]);

        await getStudentsForDocuments('b1');

        expect(prisma.student.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { branchId: 'b1' },
                include: expect.objectContaining({ payments: tuitionPayments }),
            })
        );
    });

    it('getStudentDocument throws for a student outside the given branch', async () => {
        (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(getStudentDocument('s1', 'b1')).rejects.toThrow('Student not found');
        expect(prisma.student.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 's1', branchId: 'b1' },
                include: expect.objectContaining({ payments: tuitionPayments }),
            })
        );
    });

    it('getStudentDocument returns the student when it belongs to the given branch', async () => {
        (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b1' });

        const result = await getStudentDocument('s1', 'b1');

        expect(result).toEqual({ id: 's1', branchId: 'b1' });
    });
});
