import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
import * as c from './grades.controller';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.get('/periods', c.getPeriods);
router.get('/bulletin', c.getBulletin);
router.get('/evaluations', c.listEvaluations);
router.post('/evaluations', c.createEvaluation);
router.put('/evaluations/:id', c.updateEvaluation);
router.delete('/evaluations/:id', c.deleteEvaluation);
router.put('/evaluations/:id/grades', c.saveGrades);
router.post('/evaluations/:id/publish', c.publish);

export default router;
