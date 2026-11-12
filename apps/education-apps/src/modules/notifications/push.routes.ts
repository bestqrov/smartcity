import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { sendSuccess, sendError } from '../../utils/response';
import { vapidPublicKey } from './push.sender';
import { subscribe, unsubscribe } from './push.service';

const router = Router();

const subscribeLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

const statusOf = (message: string) => (message === 'Parent not found' ? 404 : 400);

router.get('/public-key', (_req: Request, res: Response) => {
    sendSuccess(res, { publicKey: vapidPublicKey() });
});

router.post('/subscribe/:token', subscribeLimiter, async (req: Request, res: Response) => {
    try {
        sendSuccess(res, await subscribe(req.params.token, req.body?.subscription, req.body?.lang), 'Subscribed', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to subscribe', statusOf(error.message));
    }
});

router.delete('/subscribe/:token', subscribeLimiter, async (req: Request, res: Response) => {
    try {
        sendSuccess(res, await unsubscribe(req.params.token, req.body?.endpoint), 'Unsubscribed');
    } catch (error: any) {
        sendError(res, error.message, 'Failed to unsubscribe', statusOf(error.message));
    }
});

export default router;
