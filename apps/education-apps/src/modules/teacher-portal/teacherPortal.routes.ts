import { Router, Request } from 'express';
import rateLimit from 'express-rate-limit';
import { getPortal, createEvaluation, updateEvaluation, deleteEvaluation, saveGrades, publish } from './teacherPortal.controller';

const router = Router();

// Limit per link token (a school behind one NAT must not share a budget); no IP involved, so no IPv6 key concerns.
const byToken = (req: Request) => `tp:${req.params.token}`;

// Same limiter settings as the parent profile, but grade entry autosaves, so writes get a larger budget.
const readLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, keyGenerator: byToken, standardHeaders: true, legacyHeaders: false, validate: { keyGeneratorIpFallback: false } });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, keyGenerator: byToken, standardHeaders: true, legacyHeaders: false, validate: { keyGeneratorIpFallback: false } });

router.get('/:token', readLimiter, getPortal);
router.post('/:token/evaluations', writeLimiter, createEvaluation);
router.put('/:token/evaluations/:id', writeLimiter, updateEvaluation);
router.delete('/:token/evaluations/:id', writeLimiter, deleteEvaluation);
router.put('/:token/evaluations/:id/grades', writeLimiter, saveGrades);
router.post('/:token/evaluations/:id/publish', writeLimiter, publish);

export default router;
