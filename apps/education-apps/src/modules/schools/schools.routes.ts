import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { signup, getMe, updateMe, list, updateStatus } from './schools.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

const router = Router();

const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
});

// Public — no auth, this is how a new school gets created
router.post('/signup', signupLimiter, signup);

// School owner/admin manage their own school's profile
router.get('/me', authMiddleware, roleMiddleware('OWNER', 'ADMIN'), getMe);
router.put('/me', authMiddleware, roleMiddleware('OWNER', 'ADMIN'), updateMe);

// Platform-level: SUPER_ADMIN sees and activates every school, bypassing tenant scoping
router.get('/', authMiddleware, roleMiddleware('SUPER_ADMIN'), list);
router.patch('/:id/status', authMiddleware, roleMiddleware('SUPER_ADMIN'), updateStatus);

export default router;
