import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
    create,
    getAll,
    getById,
    update,
    regenerateToken,
    getPublicProfile,
} from './parents.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

const router = Router();

const publicProfileLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
});

// Public, passwordless — must come before the authMiddleware below
router.get('/profile/:token', publicProfileLimiter, getPublicProfile);

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'SUPER_ADMIN'));

router.post('/', create);
router.get('/', getAll);
router.get('/:id', getById);
router.put('/:id', update);
router.post('/:id/regenerate-token', regenerateToken);

export default router;
