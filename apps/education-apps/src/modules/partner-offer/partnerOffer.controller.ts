import { Request, Response } from 'express';
import { respond } from '../transport/http';
import { getPartnerOfferFor, getAdminPartnerOffer, updatePartnerOffer } from './partnerOffer.service';

export const publicOffer = (req: Request, res: Response) =>
    respond(res, () => getPartnerOfferFor(req.query.ref), { message: 'Partner offer checked', failure: 'Failed to check partner offer' });

export const adminGet = (_req: Request, res: Response) =>
    respond(res, () => getAdminPartnerOffer(), { message: 'Partner offer retrieved', failure: 'Failed to retrieve partner offer' });

export const adminUpdate = (req: Request, res: Response) =>
    respond(res, () => updatePartnerOffer(req.body ?? {}), { message: 'Partner offer updated', failure: 'Failed to update partner offer' });
