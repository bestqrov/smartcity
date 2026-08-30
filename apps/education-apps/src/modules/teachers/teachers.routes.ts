import { Router } from 'express';
import * as teachersController from './teachers.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.post('/', teachersController.createTeacher);
router.get('/', teachersController.getAllTeachers);
router.put('/:id', teachersController.updateTeacher);
router.delete('/:id', teachersController.deleteTeacher);

export default router;
