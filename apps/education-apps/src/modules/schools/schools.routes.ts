import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { signup } from './schools.controller';

const router = Router();

const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
});

// Public — no auth, this is how a new school gets created
router.post('/signup', signupLimiter, signup);

export default router;
