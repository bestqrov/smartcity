import prisma from '../../config/database';
import { createTransaction } from '../transactions/transactions.service';

interface CreateSalaryData {
    personnelId: string;
    personnelType: 'TEACHER' | 'SECRETARY';
    amount: number;
    month: string;
    branchId: string;
    method?: string;
    note?: string;
    date?: Date;
}

export const createSalaryPayment = async (data: CreateSalaryData) => {
    const { personnelId, personnelType, amount, month, branchId, date } = data;

    let personnelName = '';
    if (personnelType === 'TEACHER') {
        const teacher = await prisma.teacher.findUnique({ where: { id: personnelId } });
        if (!teacher || teacher.branchId !== branchId) throw new Error('Teacher not found');
        personnelName = teacher.name;
    } else {
        const user = await prisma.user.findUnique({ where: { id: personnelId } });
        if (!user || user.branchId !== branchId) throw new Error('User not found');
        personnelName = user.name;
    }

    const transaction = await createTransaction({
        type: 'EXPENSE',
        amount: amount,
        category: 'Salaire',
        branchId,
        description: `Salaire ${personnelType === 'TEACHER' ? 'Prof' : 'Secrétaire'}: ${personnelName} (${month})`,
        date: date || new Date(),
    });

    return transaction;
};
