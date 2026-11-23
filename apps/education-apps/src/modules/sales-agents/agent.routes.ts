import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireSalesAgent } from '../../middlewares/salesAgent.middleware';
import { me, updateMe, changeMyPassword } from './salesAgents.controller';
import { declare, listMine } from './paymentDeclarations.controller';

const router = Router();

// The agent's own space: only their clients, commissions and payouts.
router.get('/me', authMiddleware, requireSalesAgent, me);
router.patch('/me', authMiddleware, requireSalesAgent, updateMe);
router.patch('/me/password', authMiddleware, requireSalesAgent, changeMyPassword);
// Payments the agent reports for their clients, with the proof, waiting for the super admin.
router.get('/me/payment-declarations', authMiddleware, requireSalesAgent, listMine);
router.post('/me/payment-declarations', authMiddleware, requireSalesAgent, declare);

export default router;
