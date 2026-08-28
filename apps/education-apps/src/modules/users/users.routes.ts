import { Router } from 'express';
import { create, getAll, getById, update, remove, getSecretariesController, updateSecretaryController } from './users.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

const router = Router();

// All routes require authentication and ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN'));

// Secretary-specific routes
router.get('/secretaries', getSecretariesController);
router.put('/secretaries/:id', updateSecretaryController);

router.post('/', create);
router.get('/', getAll);
router.get('/:id', getById);
router.put('/:id', update);
router.delete('/:id', remove);

export default router;
