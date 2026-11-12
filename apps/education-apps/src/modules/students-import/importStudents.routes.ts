// src/modules/students-import/importStudents.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
import { commit, validate } from './importStudents.controller';

const router = Router();

// Same access as creating a student (POST /students).
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.post('/validate', validate);
router.post('/commit', commit);

export default router;
