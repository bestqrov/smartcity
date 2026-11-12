import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
import { capacity, pending, upgrade } from './subscription.controller';

const router = Router();

router.use(authMiddleware);

// Anyone who can add students sees the numbers; only ADMIN and OWNER commit the school to a higher price.
router.get('/capacity', roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'), tenantScopeMiddleware, capacity);
router.post('/pack-upgrade', roleMiddleware('ADMIN', 'OWNER'), tenantScopeMiddleware, upgrade);
router.get('/pack-upgrade/pending', roleMiddleware('ADMIN', 'OWNER'), tenantScopeMiddleware, pending);

export default router;
