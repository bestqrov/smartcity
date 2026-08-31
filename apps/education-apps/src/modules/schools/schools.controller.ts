import { Response, Request } from 'express';
import {
    signupSchool,
    getSchoolBySchoolId,
    updateSchoolProfile,
    listSchools,
    updateSchoolStatus,
} from './schools.service';
import { generateToken } from '../../utils/jwt';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthRequest } from '../../middlewares/auth.middleware';

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

        if (!ownerName || !ownerEmail || !password) {
            sendError(res, 'ownerName, ownerEmail, and password are required', 'Validation error', 400);
            return;
        }

        if (password.length < 8) {
            sendError(res, 'Password must be at least 8 characters', 'Validation error', 400);
            return;
        }

        const { branch, user } = await signupSchool({
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
            {
                token,
                user: { id: user.id, email: user.email, name: user.name, role: user.role, schoolId: user.schoolId },
                branch: { id: branch.id, name: branch.name },
            },
            'School created successfully',
            201
        );
    } catch (error: any) {
        sendError(res, error.message, 'Signup failed', 400);
    }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const schoolId = req.user!.schoolId;
        if (!schoolId) {
            sendError(res, 'No school associated with this account', 'Access denied', 403);
            return;
        }
        const school = await getSchoolBySchoolId(schoolId);
        sendSuccess(res, school, 'School profile retrieved', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve school profile', 404);
    }
};

export const updateMe = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const schoolId = req.user!.schoolId;
        if (!schoolId) {
            sendError(res, 'No school associated with this account', 'Access denied', 403);
            return;
        }
        const { name, director, city, address, phone, email, logo } = req.body;
        const school = await updateSchoolProfile(schoolId, { name, director, city, address, phone, email, logo });
        sendSuccess(res, school, 'School profile updated', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update school profile', 400);
    }
};

export const list = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const schools = await listSchools();
        sendSuccess(res, schools, 'Schools retrieved', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve schools', 500);
    }
};

export const updateStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['PENDING', 'ACTIVE', 'SUSPENDED'].includes(status)) {
            sendError(res, 'Invalid status', 'Status must be PENDING, ACTIVE, or SUSPENDED', 400);
            return;
        }
        const school = await updateSchoolStatus(id, status);
        sendSuccess(res, school, 'School status updated', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update school status', 400);
    }
};
