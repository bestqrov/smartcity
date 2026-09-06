import { Router } from 'express';
import { getAll, create, update, remove } from './announcements.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.get('/', getAll);
router.post('/', roleMiddleware('ADMIN', 'OWNER'), create);
router.put('/:id', roleMiddleware('ADMIN', 'OWNER'), update);
router.delete('/:id', roleMiddleware('ADMIN', 'OWNER'), remove);

export default router;
