import { Response } from 'express';
import type { AuthRequest } from '../../middlewares/auth.middleware';
import { respond } from '../transport/http';
import { createBroadcast, getBroadcast, listBroadcasts, previewBroadcast, retryBroadcast } from './broadcasts.service';
import {
    connectPlatformWhatsapp,
    disconnectPlatformWhatsapp,
    getPlatformWhatsappStatus,
} from '../notifications/platformWhatsapp.service';

export const preview = (req: AuthRequest, res: Response) =>
    respond(res, () => previewBroadcast(req.body ?? {}), { message: 'Recipients counted', failure: 'Failed to count recipients' });

export const create = (req: AuthRequest, res: Response) =>
    respond(res, () => createBroadcast(req.body ?? {}, req.user?.id ?? null), {
        message: 'Broadcast queued', failure: 'Failed to create the broadcast', status: 201,
    });

export const list = (_req: AuthRequest, res: Response) =>
    respond(res, () => listBroadcasts(), { message: 'Broadcasts retrieved', failure: 'Failed to retrieve broadcasts' });

export const getOne = (req: AuthRequest, res: Response) =>
    respond(res, () => getBroadcast(String(req.params.id)), { message: 'Broadcast retrieved', failure: 'Failed to retrieve the broadcast' });

export const retry = (req: AuthRequest, res: Response) =>
    respond(res, () => retryBroadcast(String(req.params.id)), { message: 'Failed messages requeued', failure: 'Failed to requeue' });

export const whatsappStatus = (_req: AuthRequest, res: Response) =>
    respond(res, () => getPlatformWhatsappStatus(), { message: 'WhatsApp status retrieved', failure: 'Failed to retrieve WhatsApp status' });

export const whatsappConnect = (_req: AuthRequest, res: Response) =>
    respond(res, () => connectPlatformWhatsapp(), { message: 'WhatsApp connection started', failure: 'Failed to connect WhatsApp' });

export const whatsappDisconnect = (_req: AuthRequest, res: Response) =>
    respond(res, () => disconnectPlatformWhatsapp(), { message: 'WhatsApp disconnected', failure: 'Failed to disconnect WhatsApp' });
