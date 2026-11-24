import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
    create,
    getAll,
    getById,
    update,
    remove,
    getAnalytics,
    regenerateToken,
    regeneratePortalToken,
    getPublicProfile,
} from './students.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';

import { requireFeature, requireFeatureForToken, studentPortalTokenBranch } from '../packs/packFeatures';
const router = Router();

const publicProfileLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
});

// Public, passwordless — must come before the authMiddleware below
router.get('/profile/:token', publicProfileLimiter, requireFeatureForToken('STUDENT_PORTAL', studentPortalTokenBranch), getPublicProfile);

// All routes below require authentication
router.use(authMiddleware);

// ADMIN, SECRETARY and OWNER can access students
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.get('/analytics', getAnalytics);
router.post('/', create);
router.get('/', getAll);
router.get('/:id', getById);
router.put('/:id', update);
router.delete('/:id', remove);
router.post('/:id/regenerate-token', requireFeature('QR_ATTENDANCE'), regenerateToken);
router.post('/:id/regenerate-portal-token', requireFeature('STUDENT_PORTAL'), regeneratePortalToken);

export default router;
