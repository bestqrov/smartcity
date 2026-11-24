import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { banner, getSettings, overview, putSettings } from './platform.controller';
import { confirm, getOne, list, pendingCount, reject } from '../sales-agents/paymentDeclarations.controller';

// Super admin platform dashboard.
const router = Router();

// School staff dashboards show the platform banner (declared before the super admin gate below).
router.get('/banner', authMiddleware, roleMiddleware('OWNER', 'ADMIN', 'SECRETARY'), banner);

router.use(authMiddleware);
router.use(roleMiddleware('SUPER_ADMIN'));

router.get('/overview', overview);

router.get('/settings', getSettings);
router.put('/settings', putSettings);

// Payments declared by sales agents, to confirm (payment + commission + school activated) or reject.
router.get('/payment-declarations', list);
router.get('/payment-declarations/pending-count', pendingCount);
router.get('/payment-declarations/:id', getOne);
router.post('/payment-declarations/:id/confirm', confirm);
router.post('/payment-declarations/:id/reject', reject);

export default router;
