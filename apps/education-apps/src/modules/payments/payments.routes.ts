import { Router } from 'express';
import { create, getAll, getById, getAnalytics } from './payments.controller';
import { createSalary } from './salary-payments.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

const router = Router();

// All routes require authentication and ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN')); // Ensure this line exists as viewed

router.post('/salary', createSalary); // New endpoint for salary payments
router.post('/', create);
router.get('/', getAll);
router.get('/analytics', getAnalytics);
router.get('/:id', getById);

export default router;
