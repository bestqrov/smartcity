import { Router } from 'express';
import { create, getByStudent, scan } from './attendance.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

const router = Router();

// All routes require authentication; staff (admin or secretary) can scan/record attendance
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY'));

router.post('/', create);
router.post('/scan', scan);
router.get('/student/:id', getByStudent);

export default router;
