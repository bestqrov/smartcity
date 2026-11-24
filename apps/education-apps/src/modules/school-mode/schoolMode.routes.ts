import { NextFunction, Response, Router } from 'express';
import prisma from '../../config/database';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';
import { tenantScopeMiddleware, type TenantRequest } from '../../middlewares/tenantScope.middleware';
import { collect, dues, summary, getGrid, register, saveGrid } from './schoolMode.controller';

// Only a private school (institution type) or a branch with school cycles may use school mode.
export async function schoolModeGate(req: TenantRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const [branch, settings] = await Promise.all([
            prisma.branch.findUnique({ where: { id: req.branchId! }, select: { school: { select: { institutionType: true } } } }),
            prisma.settings.findUnique({ where: { branchId: req.branchId! }, select: { schoolCycles: true } }),
        ]);
        if (branch?.school?.institutionType === 'PRIVATE_SCHOOL' || (settings?.schoolCycles?.length ?? 0) > 0) {
            next();
            return;
        }
        res.status(403).json({ success: false, error: "Le mode école privée n'est pas activé pour cet établissement", message: 'School mode disabled', code: 'SCHOOL_MODE_DISABLED' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Internal server error', message: 'Failed to check school mode' });
    }
}

// Complete private school mode: fee grid, professional inscription, monthly dues.
const router = Router();
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'OWNER'));
router.use(tenantScopeMiddleware);
router.use(schoolModeGate);

router.get('/tuition-fees', getGrid);
router.put('/tuition-fees', roleMiddleware('ADMIN', 'OWNER'), saveGrid);
router.post('/inscriptions', register);
router.get('/dues', dues);
router.get('/dues/summary', summary);
router.post('/dues/payments', collect);

export default router;
