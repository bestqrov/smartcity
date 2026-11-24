import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { publicPlatform } from './platform.controller';

// Public, no auth: what the login and signup pages need (name, support contacts, signup rules).
const router = Router();

const publicLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

router.get('/platform', publicLimiter, publicPlatform);

export default router;
