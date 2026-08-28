import prisma from '../../config/database';
import { regenerateStudentToken, updateStudent } from './students.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        student: { update: jest.fn(), findUnique: jest.fn() },
    },
}));

describe('regenerateStudentToken', () => {
    it('overwrites the stored hash and returns a new raw token', async () => {
        (prisma.student.update as jest.Mock).mockResolvedValue({ id: 's1' });

        const result = await regenerateStudentToken('s1');

        expect(prisma.student.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { accessTokenHash: expect.any(String) },
        });
        expect(result.rawToken).toEqual(expect.any(String));
    });
});

describe('updateStudent', () => {
    it('forwards parentId to the Prisma update call', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1' });
        (prisma.student.update as jest.Mock).mockResolvedValue({ id: 's1', parentId: 'p1' });

        await updateStudent('s1', { parentId: 'p1' });

        expect(prisma.student.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { parentId: 'p1' },
        });
    });
});
