import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { banner, getSettings, overview, putSettings } from './platform.controller';
import { confirm, getOne, list, pendingCount, reject } from '../sales-agents/paymentDeclarations.controller';
import * as schoolRequests from '../school-requests/schoolRequests.controller';
import * as broadcasts from './broadcasts.controller';

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

// Requests sent by schools (smaller pack, feature, problem...): status and reply.
router.get('/school-requests', schoolRequests.list);
router.get('/school-requests/pending-count', schoolRequests.newCount);
router.patch('/school-requests/:id', schoolRequests.update);

// Platform WhatsApp number (instance "arwa-platform") used by broadcasts.
router.get('/whatsapp', broadcasts.whatsappStatus);
router.post('/whatsapp/connect', broadcasts.whatsappConnect);
router.post('/whatsapp/disconnect', broadcasts.whatsappDisconnect);

// Broadcasts to school owners (email + WhatsApp).
router.post('/broadcasts/preview', broadcasts.preview);
router.get('/broadcasts', broadcasts.list);
router.post('/broadcasts', broadcasts.create);
router.get('/broadcasts/:id', broadcasts.getOne);
router.post('/broadcasts/:id/retry', broadcasts.retry);

export default router;
