import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { check, list, create, detail, update, addPayout, removePayout, resetPassword } from './salesAgents.controller';

const router = Router();

// Public, no auth — the signup form checks a code on blur. Limited so codes can't be brute-forced quickly.
const checkLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
});

router.get('/check/:code', checkLimiter, check);

router.use(authMiddleware);
router.use(roleMiddleware('SUPER_ADMIN'));

router.get('/', list);
router.post('/', create);
router.get('/:id', detail);
router.patch('/:id', update);
router.patch('/:id/password', resetPassword);
router.post('/:id/payouts', addPayout);
router.delete('/:id/payouts/:payoutId', removePayout);

export default router;
