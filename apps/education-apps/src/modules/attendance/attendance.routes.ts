import { Router } from 'express';
import { create, getByStudent } from './attendance.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

const router = Router();

// All routes require authentication and ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN'));

router.post('/', create);
router.get('/student/:id', getByStudent);

export default router;
