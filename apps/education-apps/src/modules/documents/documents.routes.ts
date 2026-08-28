import { Router } from 'express';
import { getSoutienStudentsController, getStudentDocumentController } from './documents.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

const router = Router();

// All routes require authentication and ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN'));

router.get('/students', getSoutienStudentsController);
router.get('/student/:id', getStudentDocumentController);

export default router;
