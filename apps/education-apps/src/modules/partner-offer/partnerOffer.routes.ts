import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { publicOffer, adminGet, adminUpdate } from './partnerOffer.controller';

const router = Router();

// Public, no auth — same limit as the referral code check, so codes can't be brute-forced quickly.
const offerLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

router.get('/', offerLimiter, publicOffer);

router.get('/admin', authMiddleware, roleMiddleware('SUPER_ADMIN'), adminGet);
router.put('/', authMiddleware, roleMiddleware('SUPER_ADMIN'), adminUpdate);

export default router;
