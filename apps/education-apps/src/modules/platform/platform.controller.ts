import { Request, Response } from 'express';
import { respond } from '../transport/http';
import { getPlatformOverview } from './platform.service';

export const overview = (_req: Request, res: Response) =>
    respond(res, () => getPlatformOverview(), {
        message: 'Platform overview retrieved',
        failure: 'Failed to retrieve platform overview',
    });
