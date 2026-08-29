import { Request, Response } from 'express';
import { signupSchool } from './schools.service';
import { generateToken } from '../../utils/jwt';
import { sendSuccess, sendError } from '../../utils/response';

export const signup = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            schoolName,
            ownerName,
            ownerEmail,
            ownerPhone,
            password,
            branchName,
            branchCity,
            packTier,
        } = req.body;

        if (!schoolName || !ownerName || !ownerEmail || !password || !branchName || !branchCity || !packTier) {
            sendError(res, 'schoolName, ownerName, ownerEmail, password, branchName, branchCity, and packTier are required', 'Validation error', 400);
            return;
        }

        if (password.length < 8) {
            sendError(res, 'Password must be at least 8 characters', 'Validation error', 400);
            return;
        }

        const { user } = await signupSchool({
            schoolName,
            ownerName,
            ownerEmail,
            ownerPhone,
            password,
            branchName,
            branchCity,
            packTier,
        });

        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            schoolId: user.schoolId,
            branchId: user.branchId,
        });

        sendSuccess(
            res,
            { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, schoolId: user.schoolId } },
            'School created successfully',
            201
        );
    } catch (error: any) {
        sendError(res, error.message, 'Signup failed', 400);
    }
};
