import prisma from '../../config/database';
import { getStudentsForDocuments, getStudentDocument } from './documents.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: { student: { findMany: jest.fn(), findUnique: jest.fn() } },
}));

const tuitionPayments = { where: { OR: [{ transportSubscriptionId: null }, { transportSubscriptionId: { isSet: false } }] }, orderBy: { date: 'desc' } };

describe('documents service — tuition-only payments', () => {
    afterEach(() => jest.clearAllMocks());

    it('getStudentsForDocuments excludes transport payments', async () => {
        (prisma.student.findMany as jest.Mock).mockResolvedValue([]);

        await getStudentsForDocuments();

        expect(prisma.student.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ include: expect.objectContaining({ payments: tuitionPayments }) })
        );
    });

    it('getStudentDocument excludes transport payments', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1' });

        await getStudentDocument('s1');

        expect(prisma.student.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({ include: expect.objectContaining({ payments: tuitionPayments }) })
        );
    });
});
