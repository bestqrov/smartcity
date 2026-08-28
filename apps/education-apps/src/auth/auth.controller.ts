import { Request, Response } from 'express';
import { loginUser } from './auth.service';
import { sendSuccess, sendError } from '../utils/response';
import { createUser } from '../modules/users/users.service';

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;
        console.log('Login Body:', JSON.stringify(req.body));
        console.log('Login attempt for:', email);

        // Validate input
        if (!email || !password) {
            console.log('Missing credentials');
            sendError(res, 'Email and password are required', 'Validation error', 400);
            return;
        }

        const result = await loginUser({ email, password });
        console.log('Login successful for:', email);

        sendSuccess(res, result, 'Login successful', 200);
    } catch (error: any) {
        console.error('Login error:', error.message);
        sendError(res, error.message, 'Login failed', 401);
    }
};

export const registerAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password, name } = req.body;

        // Validate input
        if (!email || !password || !name) {
            sendError(res, 'Email, password, and name are required', 'Validation error', 400);
            return;
        }

        // Check if any admin already exists
        const prisma = (await import('../config/database')).default;
        const existingAdmin = await prisma.user.findFirst({
            where: { role: 'ADMIN' },
        });

        if (existingAdmin) {
            sendError(res, 'Admin account already exists', 'Registration not allowed', 403);
            return;
        }

        // Create admin user
        const user = await createUser({
            email,
            password,
            name,
            role: 'ADMIN',
        });

        // ... existing code ...
        sendSuccess(res, user, 'Admin account created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Registration failed', 400);
    }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.id;

        if (!userId) {
            sendError(res, 'User not authenticated', 'Authentication required', 401);
            return;
        }

        const prisma = (await import('../config/database')).default;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                avatar: true,
                gsm: true,
                whatsapp: true,
                address: true,
                schoolLevel: true,
                certification: true,
                createdAt: true,
            },
        });

        if (!user) {
            sendError(res, 'User not found', 'Not found', 404);
            return;
        }

        sendSuccess(res, user, 'User profile retrieved', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to fetch user profile', 500);
    }
};
