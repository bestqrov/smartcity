import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { me, updateMe, changeMyPassword } from './salesAgents.controller';

const router = Router();

// The agent's own space: only their clients, commissions and payouts.
router.get('/me', authMiddleware, roleMiddleware('SALES_AGENT'), me);
router.patch('/me', authMiddleware, roleMiddleware('SALES_AGENT'), updateMe);
router.patch('/me/password', authMiddleware, roleMiddleware('SALES_AGENT'), changeMyPassword);

export default router;
