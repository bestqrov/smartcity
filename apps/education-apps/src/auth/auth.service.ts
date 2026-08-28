import prisma from '../config/database';
import { comparePassword } from '../utils/bcrypt';
import { generateToken } from '../utils/jwt';

interface LoginData {
    email: string;
    password: string;
}

export const loginUser = async (data: LoginData) => {
    const { email, password } = data;

    // Find user by email (case-insensitive)
    const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
    });

    if (!user) {
        console.log('User not found:', email);
        throw new Error('Invalid email or password');
    }

    // Verify password
    console.log('Verifying password for:', email);
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
        console.log('Invalid password for:', email);
        throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
    });

    return {
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        },
    };
};
