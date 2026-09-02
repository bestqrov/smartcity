import { Router } from 'express';
import { getAll, create, update, remove, bulkUpsert } from './pricing.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

// GET /pricing - Get all pricing (or filter by category)
router.get('/', getAll);

// POST /pricing - Create new pricing (ADMIN/OWNER only)
router.post('/', roleMiddleware('ADMIN', 'OWNER'), create);

// PUT /pricing/bulk - Bulk upsert pricing (ADMIN/OWNER only)
router.put('/bulk', roleMiddleware('ADMIN', 'OWNER'), bulkUpsert);

// PUT /pricing/:id - Update pricing (ADMIN/OWNER only)
router.put('/:id', roleMiddleware('ADMIN', 'OWNER'), update);

// DELETE /pricing/:id - Delete pricing (ADMIN/OWNER only)
router.delete('/:id', roleMiddleware('ADMIN', 'OWNER'), remove);

export default router;
