import { Router } from 'express';
import { create, getAll, getById, update, remove, getAnalytics } from './inscriptions.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Both ADMIN and SECRETARY can access inscriptions (Secretary's only module)
router.use(roleMiddleware('ADMIN', 'SECRETARY'));

router.get('/analytics', getAnalytics);
router.post('/', create);
router.get('/', getAll);
router.get('/:id', getById);
router.put('/:id', update);
router.delete('/:id', remove);

export default router;
