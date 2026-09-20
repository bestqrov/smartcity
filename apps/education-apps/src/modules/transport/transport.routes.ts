import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware } from '../../middlewares/tenantScope.middleware';
import * as vehicles from './vehicles.controller';
import * as drivers from './drivers.controller';
import * as routes from './routes.controller';
import * as subscriptions from './subscriptions.controller';
import * as payments from './payments.controller';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);

router.get('/vehicles', vehicles.getAll);
router.post('/vehicles', vehicles.create);
router.put('/vehicles/:id', vehicles.update);
router.delete('/vehicles/:id', vehicles.remove);

router.get('/drivers', drivers.getAll);
router.post('/drivers', drivers.create);
router.put('/drivers/:id', drivers.update);
router.delete('/drivers/:id', drivers.remove);

router.get('/routes', routes.getAll);
router.post('/routes', routes.create);
router.put('/routes/:id', routes.update);
router.delete('/routes/:id', routes.remove);
router.post('/routes/:id/stops', routes.addStop);
router.put('/routes/:id/stops/:stopId', routes.editStop);
router.delete('/routes/:id/stops/:stopId', routes.removeStop);

router.get('/subscriptions', subscriptions.getAll);
router.get('/subscriptions/student/:studentId', subscriptions.getForStudent);
router.post('/subscriptions', subscriptions.create);
router.post('/subscriptions/:id/pause', subscriptions.pause);
router.post('/subscriptions/:id/resume', subscriptions.resume);
router.post('/subscriptions/:id/end', subscriptions.end);
router.post('/subscriptions/:id/payments', payments.record);

router.get('/dues', payments.dues);

export default router;
