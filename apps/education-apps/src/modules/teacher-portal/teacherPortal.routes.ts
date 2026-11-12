import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getPortal, createEvaluation, updateEvaluation, deleteEvaluation, saveGrades, publish } from './teacherPortal.controller';

const router = Router();

// Same limiter settings as the parent profile, but grade entry autosaves, so writes get a larger budget.
const readLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });

router.get('/:token', readLimiter, getPortal);
router.post('/:token/evaluations', writeLimiter, createEvaluation);
router.put('/:token/evaluations/:id', writeLimiter, updateEvaluation);
router.delete('/:token/evaluations/:id', writeLimiter, deleteEvaluation);
router.put('/:token/evaluations/:id/grades', writeLimiter, saveGrades);
router.post('/:token/evaluations/:id/publish', writeLimiter, publish);

export default router;
