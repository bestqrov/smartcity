import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
    create,
    getAll,
    getById,
    update,
    regenerateToken,
    getPublicProfile,
    issueLinks,
    getAccess,
    getNotifications,
    readNotifications,
} from './parents.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
import { parentRespond, parentCover } from '../activities/activities.controller';

import { parentTokenBranch, requireFeature, requireFeatureForToken } from '../packs/packFeatures';
const router = Router();

const publicProfileLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
});

// Public, passwordless — must come before the authMiddleware below
// The parent space exists only for schools whose pack includes the parent portal.
const parentPortal = requireFeatureForToken('PARENT_PORTAL', parentTokenBranch);
router.get('/profile/:token', publicProfileLimiter, parentPortal, getPublicProfile);

// Keyed per link token, like the teacher portal (a whole school behind one NAT must not share a budget).
const activityResponseLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => `ar:${req.params.token}`,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
});
const notificationsLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: (req) => `pn:${req.params.token}`,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
});
router.get('/notifications/:token', notificationsLimiter, parentPortal, getNotifications);
router.post('/notifications/:token/read', notificationsLimiter, parentPortal, readNotifications);

router.post('/activity-response/:token', activityResponseLimiter, parentPortal, parentRespond);

const activityCoverLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    keyGenerator: (req) => `ac:${req.params.token}`,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
});
router.get('/activity-cover/:token/:id', activityCoverLimiter, parentPortal, parentCover);

router.use(authMiddleware);
// Branch staff only: parents are scoped to the branch their children study in.
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.post('/', create);
router.get('/', getAll);
// Fixed paths must stay above '/:id'.
router.get('/access', requireFeature('PARENT_PORTAL'), getAccess);
router.post('/links', requireFeature('PARENT_PORTAL'), issueLinks);
router.get('/:id', getById);
router.put('/:id', update);
router.post('/:id/regenerate-token', requireFeature('PARENT_PORTAL'), regenerateToken);

export default router;
