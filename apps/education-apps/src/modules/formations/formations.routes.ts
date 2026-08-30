import { Router } from 'express';
import {
    createFormationHandler,
    getFormationsHandler,
    updateFormationHandler,
    deleteFormationHandler,
    getAnalytics,
} from './formations.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.get('/analytics', roleMiddleware('ADMIN', 'OWNER'), getAnalytics);
router.post('/', roleMiddleware('ADMIN', 'OWNER'), createFormationHandler);
router.get('/', getFormationsHandler);
router.put('/:id', roleMiddleware('ADMIN', 'OWNER'), updateFormationHandler);
router.delete('/:id', roleMiddleware('ADMIN', 'OWNER'), deleteFormationHandler);

export default router;
