import { Router } from 'express';
import { get, update } from './settings.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';

const router = Router();

// Owner and admin change the settings; the secretary reads them too (the school cycles
// decide which inscription form she gets).
router.use(authMiddleware);

router.get('/', roleMiddleware('ADMIN', 'OWNER', 'SECRETARY'), tenantScopeMiddleware, get);
router.put('/', roleMiddleware('ADMIN', 'OWNER'), tenantScopeMiddleware, update);

export default router;
