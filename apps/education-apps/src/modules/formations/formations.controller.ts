import { Response } from 'express';
import {
    createFormation,
    getFormations,
    updateFormation,
    deleteFormation,
    getFormationAnalytics,
} from './formations.service';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

export const createFormationHandler = async (req: TenantRequest, res: Response) => {
    try {
        const { name, duration, price, description } = req.body;
        const formation = await createFormation({
            name,
            duration,
            price: parseFloat(price),
            branchId: req.branchId!,
            description,
        });
        res.status(201).json(formation);
    } catch (error) {
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
        const { name, duration, price, description } = req.body;
        const formation = await updateFormation(id, req.branchId!, {
            name,
            duration,
            price: parseFloat(price),
            description,
        });
        res.json(formation);
    } catch (error) {
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
        const analytics = await getFormationAnalytics();
        res.json(analytics);
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Error fetching analytics' });
    }
};
