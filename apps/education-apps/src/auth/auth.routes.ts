import { Router } from 'express';
import { login, registerAdmin } from './auth.controller';

const router = Router();

router.post('/login', login);
router.post('/register-admin', registerAdmin);
// Note: router definition order matters if middleware is involved, but here we add it explicitly
import { authMiddleware } from '../middlewares/auth.middleware';
import { getMe } from './auth.controller';
router.get('/me', authMiddleware, getMe);

export default router;
