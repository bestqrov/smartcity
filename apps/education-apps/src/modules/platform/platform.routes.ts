import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { overview } from './platform.controller';

// Super admin platform dashboard.
const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('SUPER_ADMIN'));

router.get('/overview', overview);

export default router;
