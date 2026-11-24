import { Request, Response } from 'express';
import { respond } from '../transport/http';
import { getPlatformOverview } from './platform.service';
import { getPlatformBanner, getPlatformSettings, getPublicPlatformSettings, updatePlatformSettings } from './platformSettings.service';

export const overview = (_req: Request, res: Response) =>
    respond(res, () => getPlatformOverview(), {
        message: 'Platform overview retrieved',
        failure: 'Failed to retrieve platform overview',
    });

export const getSettings = (_req: Request, res: Response) =>
    respond(res, () => getPlatformSettings(), {
        message: 'Platform settings retrieved',
        failure: 'Failed to retrieve platform settings',
    });

export const putSettings = (req: Request, res: Response) =>
    respond(res, () => updatePlatformSettings(req.body ?? {}), {
        message: 'Platform settings updated',
        failure: 'Failed to update platform settings',
    });

export const banner = (_req: Request, res: Response) =>
    respond(res, () => getPlatformBanner(), {
        message: 'Platform banner retrieved',
        failure: 'Failed to retrieve platform banner',
    });

export const publicPlatform = (_req: Request, res: Response) =>
    respond(res, () => getPublicPlatformSettings(), {
        message: 'Platform info retrieved',
        failure: 'Failed to retrieve platform info',
    });
