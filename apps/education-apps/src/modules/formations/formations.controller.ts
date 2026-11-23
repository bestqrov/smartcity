import { Response } from 'express';
import {
    createFormation,
    getFormations,
    updateFormation,
    deleteFormation,
    getFormationAnalytics,
} from './formations.service';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

// Checked here so a bad form answers 400 with a sentence for the user, not a 500 "Error creating formation".
const validateFormation = (body: Record<string, unknown>) => {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const duration = typeof body.duration === 'string' ? body.duration.trim() : '';
    const price = body.price === undefined || body.price === null || body.price === '' ? 0 : Number(body.price);
    if (!name) return { error: 'Le nom de la formation est obligatoire.' };
    if (!duration) return { error: 'La durée de la formation est obligatoire.' };
    if (!Number.isFinite(price) || price < 0) return { error: 'Le prix doit être un nombre positif.' };
    const description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : undefined;
    return { data: { name, duration, price, description } };
};

export const createFormationHandler = async (req: TenantRequest, res: Response) => {
    const checked = validateFormation(req.body ?? {});
    if (!checked.data) {
        res.status(400).json({ error: checked.error });
        return;
    }
    try {
        const formation = await createFormation({ ...checked.data, branchId: req.branchId! });
        res.status(201).json(formation);
    } catch (error) {
        console.error('Error creating formation:', error);
        res.status(500).json({ error: 'Error creating formation' });
    }
};

export const getFormationsHandler = async (req: TenantRequest, res: Response) => {
    try {
        const formations = await getFormations(req.branchId!);
        res.json(formations);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching formations' });
    }
};

export const updateFormationHandler = async (req: TenantRequest, res: Response) => {
    try {
        const { id } = req.params;
        const checked = validateFormation(req.body ?? {});
        if (!checked.data) {
            res.status(400).json({ error: checked.error });
            return;
        }
        const formation = await updateFormation(id, req.branchId!, checked.data);
        res.json(formation);
    } catch (error) {
        console.error('Error updating formation:', error);
        if (error instanceof Error && error.message === 'Formation not found') {
            res.status(404).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Error updating formation' });
    }
};

export const deleteFormationHandler = async (req: TenantRequest, res: Response) => {
    try {
        const { id } = req.params;
        await deleteFormation(id, req.branchId!);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Error deleting formation' });
    }
};

export const getAnalytics = async (req: TenantRequest, res: Response) => {
    try {
        const analytics = await getFormationAnalytics(req.branchId!);
        res.json(analytics);
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Error fetching analytics' });
    }
};
