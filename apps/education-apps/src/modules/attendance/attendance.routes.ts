import { Router } from 'express';
import { getByStudent, mark, markWholeSession, scan, week } from './attendance.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';

const router = Router();

// All routes require authentication; staff (admin or secretary) can scan/record attendance
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.post('/scan', scan);
router.get('/week', week);
router.put('/mark', mark);
router.put('/session', markWholeSession);
router.get('/student/:id', getByStudent);

export default router;
