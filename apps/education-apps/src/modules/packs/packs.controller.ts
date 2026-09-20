import { Request, Response } from 'express';
import { respond } from '../transport/http';
import { listPublicPacks, listAllPacks, createPack, updatePack, setDefaultPack } from './packs.service';

export const publicList = (req: Request, res: Response) =>
    respond(res, () => listPublicPacks(req.query.type), {
        message: 'Packs retrieved successfully',
        failure: 'Failed to retrieve packs',
    });

export const list = (_req: Request, res: Response) =>
    respond(res, () => listAllPacks(), {
        message: 'Packs retrieved successfully',
        failure: 'Failed to retrieve packs',
    });

export const create = (req: Request, res: Response) =>
    respond(res, () => createPack(req.body ?? {}), {
        message: 'Pack created successfully',
        status: 201,
        failure: 'Failed to create pack',
    });

export const update = (req: Request, res: Response) =>
    respond(res, () => updatePack(req.params.id, req.body ?? {}), {
        message: 'Pack updated successfully',
        failure: 'Failed to update pack',
    });

export const makeDefault = (req: Request, res: Response) =>
    respond(res, () => setDefaultPack(req.params.id), {
        message: 'Default pack updated successfully',
        failure: 'Failed to set default pack',
    });
