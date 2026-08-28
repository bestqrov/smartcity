import { Router } from 'express';
import { createFormation, getFormations, updateFormation, deleteFormation, getAnalytics } from './formations.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

const router = Router();

router.get('/analytics', authMiddleware, roleMiddleware('ADMIN'), getAnalytics);
router.post('/', authMiddleware, roleMiddleware('ADMIN'), createFormation);
router.get('/', authMiddleware, getFormations);
router.put('/:id', authMiddleware, roleMiddleware('ADMIN'), updateFormation);
router.delete('/:id', authMiddleware, roleMiddleware('ADMIN'), deleteFormation);

export default router;
