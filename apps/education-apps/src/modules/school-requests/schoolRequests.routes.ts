import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
import { create, listMine } from './schoolRequests.controller';

// School side: ADMIN and OWNER send requests to the super admin and read the replies.
const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'OWNER'));

router.post('/', tenantScopeMiddleware, create);
router.get('/mine', tenantScopeMiddleware, listMine);

export default router;
