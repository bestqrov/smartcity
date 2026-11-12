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
} from './parents.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
import { parentRespond } from '../activities/activities.controller';

const router = Router();

const publicProfileLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
});

// Public, passwordless — must come before the authMiddleware below
router.get('/profile/:token', publicProfileLimiter, getPublicProfile);

// Keyed per link token, like the teacher portal (a whole school behind one NAT must not share a budget).
const activityResponseLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => `ar:${req.params.token}`,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
});
router.post('/activity-response/:token', activityResponseLimiter, parentRespond);

router.use(authMiddleware);
// Branch staff only: parents are scoped to the branch their children study in.
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.post('/', create);
router.get('/', getAll);
// Fixed paths must stay above '/:id'.
router.get('/access', getAccess);
router.post('/links', issueLinks);
router.get('/:id', getById);
router.put('/:id', update);
router.post('/:id/regenerate-token', regenerateToken);

export default router;
