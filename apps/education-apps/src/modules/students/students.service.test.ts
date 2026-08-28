import prisma from '../../config/database';
import { regenerateStudentToken } from './students.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        student: { update: jest.fn() },
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
