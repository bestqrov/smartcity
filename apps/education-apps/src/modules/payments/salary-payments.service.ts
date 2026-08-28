
import prisma from '../../config/database';
import { createTransaction } from '../transactions/transactions.service';

interface CreateSalaryData {
    personnelId: string;
    personnelType: 'TEACHER' | 'SECRETARY';
    amount: number;
    month: string;
    method?: string;
    note?: string;
    date?: Date;
}

export const createSalaryPayment = async (data: CreateSalaryData) => {
    const { personnelId, personnelType, amount, month, method, note, date } = data;

    // Verify personnel exists
    let personnelName = '';
    if (personnelType === 'TEACHER') {
        const teacher = await prisma.teacher.findUnique({ where: { id: personnelId } });
        if (!teacher) throw new Error('Teacher not found');
        personnelName = teacher.name;
    } else {
        const user = await prisma.user.findUnique({ where: { id: personnelId } });
        if (!user) throw new Error('User not found');
        personnelName = user.name;
    }

    // Create EXPENSE transaction
    const transaction = await createTransaction({
        type: 'EXPENSE',
        amount: amount,
        category: 'Salaire',
        description: `Salaire ${personnelType === 'TEACHER' ? 'Prof' : 'Secrétaire'}: ${personnelName} (${month})`,
        date: date || new Date(),
    });

    return transaction;
};
