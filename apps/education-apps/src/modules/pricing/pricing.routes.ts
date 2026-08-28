import { Router } from 'express';
import { getAll, create, update, remove, bulkUpsert } from './pricing.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /pricing - Get all pricing (or filter by category)
router.get('/', getAll);

// POST /pricing - Create new pricing (ADMIN only)
router.post('/', roleMiddleware('ADMIN'), create);

// PUT /pricing/bulk - Bulk upsert pricing (ADMIN only)
router.put('/bulk', roleMiddleware('ADMIN'), bulkUpsert);

// PUT /pricing/:id - Update pricing (ADMIN only)
router.put('/:id', roleMiddleware('ADMIN'), update);

// DELETE /pricing/:id - Delete pricing (ADMIN only)
router.delete('/:id', roleMiddleware('ADMIN'), remove);

export default router;
