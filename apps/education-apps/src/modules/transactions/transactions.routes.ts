import { Router } from 'express';
import { create, getAll, getStats, remove } from './transactions.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN'));

router.post('/', create);
router.get('/', getAll);
router.get('/stats', getStats);
router.delete('/:id', remove);

export default router;
