import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createFormation = async (req: Request, res: Response) => {
    try {
        const { name, duration, price, description } = req.body;
        const formation = await prisma.formation.create({
            data: {
                name,
                duration,
                price: parseFloat(price),
                description,
            },
        });
        res.status(201).json(formation);
    } catch (error) {
        res.status(500).json({ error: 'Error creating formation' });
    }
};

export const getFormations = async (req: Request, res: Response) => {
    try {
        const formations = await prisma.formation.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json(formations);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching formations' });
    }
};

export const updateFormation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, duration, price, description } = req.body;
        const formation = await prisma.formation.update({
            where: { id },
            data: {
                name,
                duration,
                price: parseFloat(price),
                description,
            },
        });
        res.json(formation);
    } catch (error) {
        res.status(500).json({ error: 'Error updating formation' });
    }
};

export const deleteFormation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.formation.delete({
            where: { id },
        });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Error deleting formation' });
    }
};

export const getAnalytics = async (req: Request, res: Response) => {
    try {
        const totalFormations = await prisma.formation.count();
        const totalInscriptions = await prisma.inscription.count({
            where: { type: 'FORMATION' }
        });
        const revenue = await prisma.inscription.aggregate({
            where: { type: 'FORMATION' },
            _sum: { amount: true }
        });

        // Calculate Monthly Revenue
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        const monthlyRevenue = await prisma.inscription.aggregate({
            where: {
                type: 'FORMATION',
                createdAt: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            },
            _sum: { amount: true }
        });

        // Get recent inscriptions
        const recentInscriptions = await prisma.inscription.findMany({
            where: { type: 'FORMATION' },
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                student: true
            }
        });

        res.json({
            totalFormations,
            totalInscriptions,
            totalRevenue: revenue._sum.amount || 0,
            monthlyRevenue: monthlyRevenue._sum.amount || 0,
            recentInscriptions
        });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Error fetching analytics' });
    }
};
