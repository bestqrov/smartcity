import { NextFunction, Request, Response } from 'express';
import prisma from '../../config/database';
import { hashToken } from '../../utils/accessToken';
import { sendError } from '../../utils/response';
import type { TenantRequest } from '../../middlewares/tenantScope.middleware';
import type { PackFeature } from './packs.constants';

// A school sees an option only when its pack checks it. A school with no pack at all (legacy accounts)
// keeps everything: `null` means "no restriction".
export const featuresOfBranch = async (branchId: string): Promise<string[] | null> => {
    const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { school: { select: { pack: { select: { features: true } } } } },
    });
    const pack = branch?.school?.pack;
    return pack ? pack.features : null;
};

export const branchHasFeature = async (branchId: string, feature: PackFeature): Promise<boolean> => {
    const features = await featuresOfBranch(branchId);
    return features === null || features.includes(feature);
};

const refuse = (res: Response, feature: PackFeature) =>
    sendError(res, 'FEATURE_NOT_IN_PACK', `Cette fonction (${feature}) n'est pas incluse dans le pack de l'école.`, 403);

/** For staff routes, after tenantScopeMiddleware (which sets req.branchId). */
export const requireFeature =
    (feature: PackFeature) =>
    async (req: TenantRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!req.branchId) {
            next(); // nothing to scope: the route's own checks answer
            return;
        }
        try {
            if (await branchHasFeature(req.branchId, feature)) {
                next();
                return;
            }
        } catch (error) {
            console.error('Pack feature check failed:', error);
            sendError(res, 'Internal server error', 'Failed to check the pack', 500);
            return;
        }
        refuse(res, feature);
    };

/** For the public portals opened with a link token: the token's branch must have the option. */
export const requireFeatureForToken =
    (feature: PackFeature, branchOfToken: (token: string) => Promise<string | null | undefined>) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const branchId = req.params.token ? await branchOfToken(req.params.token) : null;
            // An unknown token is left to the route, which answers "not found" as before.
            if (!branchId || (await branchHasFeature(branchId, feature))) {
                next();
                return;
            }
        } catch (error) {
            console.error('Pack feature check failed:', error);
            sendError(res, 'Internal server error', 'Failed to check the pack', 500);
            return;
        }
        refuse(res, feature);
    };

export const parentTokenBranch = async (token: string) =>
    (await prisma.parent.findUnique({ where: { accessTokenHash: hashToken(token) }, select: { branchId: true } }))?.branchId ?? null;

export const studentPortalTokenBranch = async (token: string) =>
    (await prisma.student.findFirst({ where: { portalTokenHash: hashToken(token) }, select: { branchId: true } }))?.branchId ?? null;
