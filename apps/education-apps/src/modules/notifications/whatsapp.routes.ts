import { Router, Response } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware, TenantRequest } from '../../middlewares/tenantScope.middleware';
import { sendSuccess, sendError } from '../../utils/response';
import * as whatsapp from './whatsapp.service';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'OWNER'));
router.use(tenantScopeMiddleware);

const handle = (fn: (req: TenantRequest) => Promise<unknown>) => async (req: TenantRequest, res: Response) => {
    try {
        sendSuccess(res, await fn(req));
    } catch (error: any) {
        sendError(res, error.message, 'WhatsApp request failed', 400);
    }
};

router.get('/status', handle((req) => whatsapp.getStatus(req.branchId!)));
router.post('/connect', handle((req) => whatsapp.connect(req.branchId!)));
router.put('/settings', handle((req) => whatsapp.updateSettings(req.branchId!, req.body || {})));
router.post('/test', handle((req) => whatsapp.sendTest(req.branchId!, req.body?.phone)));
router.post('/disconnect', handle((req) => whatsapp.disconnect(req.branchId!)));
router.get('/messages', handle((req) => whatsapp.recentMessages(req.branchId!)));

export default router;
