import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
import { get, update } from './onboarding.controller';

// Setup checklist of the caller's branch, for the school admin.
const router = Router();
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'OWNER'));
router.use(tenantScopeMiddleware);

router.get('/', get);
router.patch('/', update);

export default router;
