import prisma from '../config/database';
import { loginUser } from './auth.service';
import * as bcryptUtil from '../utils/bcrypt';
import * as jwtUtil from '../utils/jwt';

jest.mock('../config/database', () => ({
    __esModule: true,
    default: {
        user: { findUnique: jest.fn() },
    },
}));

describe('loginUser', () => {
    afterEach(() => jest.restoreAllMocks());

    it('includes schoolId and branchId in the generated token payload for an OWNER', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({
            id: 'u1',
            email: 'owner@example.com',
            password: 'hashed',
            role: 'OWNER',
            name: 'Owner',
            schoolId: 's1',
            branchId: null,
        });
        jest.spyOn(bcryptUtil, 'comparePassword').mockResolvedValue(true);
        const generateTokenSpy = jest.spyOn(jwtUtil, 'generateToken').mockReturnValue('signed-token');

        await loginUser({ email: 'owner@example.com', password: 'pw' });

        expect(generateTokenSpy).toHaveBeenCalledWith({
            id: 'u1',
            email: 'owner@example.com',
            role: 'OWNER',
            name: 'Owner',
            schoolId: 's1',
            branchId: null,
        });
    });

    it('includes branchId (and null schoolId) for an ADMIN', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({
            id: 'u2',
            email: 'admin@example.com',
            password: 'hashed',
            role: 'ADMIN',
            name: 'Admin',
            schoolId: null,
            branchId: 'b1',
        });
        jest.spyOn(bcryptUtil, 'comparePassword').mockResolvedValue(true);
        const generateTokenSpy = jest.spyOn(jwtUtil, 'generateToken').mockReturnValue('signed-token');

        await loginUser({ email: 'admin@example.com', password: 'pw' });

        expect(generateTokenSpy).toHaveBeenCalledWith({
            id: 'u2',
            email: 'admin@example.com',
            role: 'ADMIN',
            name: 'Admin',
            schoolId: null,
            branchId: 'b1',
        });
    });
});
