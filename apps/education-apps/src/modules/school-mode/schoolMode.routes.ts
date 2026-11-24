import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
import { collect, dues, getGrid, register, saveGrid } from './schoolMode.controller';

// Complete private school mode: fee grid, professional inscription, monthly dues.
const router = Router();
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.get('/tuition-fees', getGrid);
router.put('/tuition-fees', roleMiddleware('ADMIN', 'OWNER'), saveGrid);
router.post('/inscriptions', register);
router.get('/dues', dues);
router.post('/dues/payments', collect);

export default router;
