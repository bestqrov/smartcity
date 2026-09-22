import { Router } from 'express';
import { getSoutienStudentsController, getStudentDocumentController } from './documents.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.get('/students', getSoutienStudentsController);
router.get('/student/:id', getStudentDocumentController);

export default router;
