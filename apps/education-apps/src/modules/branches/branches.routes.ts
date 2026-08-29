import { Router } from 'express';
import { getAll, getSummary } from './branches.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('OWNER'));

router.get('/', getAll);
router.get('/summary', getSummary);

export default router;
