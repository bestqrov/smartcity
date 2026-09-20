import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { publicList, list, create, update, makeDefault } from './packs.controller';

const router = Router();

const publicLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
});

// Public, no auth — feeds the landing page and the signup page. Must come before the auth middleware below.
router.get('/public', publicLimiter, publicList);

router.use(authMiddleware);
router.use(roleMiddleware('SUPER_ADMIN'));

router.get('/', list);
router.post('/', create);
router.put('/:id', update);
router.patch('/:id/default', makeDefault);

export default router;
