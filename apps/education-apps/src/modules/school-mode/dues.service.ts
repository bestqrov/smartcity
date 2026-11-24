// src/modules/school-mode/dues.service.ts
import prisma from '../../config/database';
import { assertId } from '../transport/ids';
import { createTransaction } from '../transactions/transactions.service';
import { isDueMonth, isMonthKey } from './schoolYear';

export type DueStatus = 'PAID' | 'PARTIAL' | 'UNPAID';
const round = (n: number) => Math.round(n * 100) / 100;
// Tuition months only: transport payments carry a transportSubscriptionId.
const TUITION = { OR: [{ transportSubscriptionId: null }, { transportSubscriptionId: { isSet: false } }] };

export const listDues = async (branchId: string, month: string) => {
    if (!isMonthKey(month)) throw new Error('Le mois doit être au format AAAA-MM');
    const empty = { month, rows: [] as any[], totals: { expected: 0, collected: 0, remaining: 0 } };
    if (!isDueMonth(month)) return empty;

    const students = await prisma.student.findMany({
        where: { branchId, active: true, monthlyFee: { gt: 0 } },
        select: { id: true, name: true, surname: true, schoolLevel: true, monthlyFee: true, parentPhone: true, groupIds: true },
        orderBy: [{ surname: 'asc' }, { name: 'asc' }],
    });
    const payments = await prisma.payment.findMany({
        where: { branchId, forMonth: month, ...TUITION, studentId: { in: students.map((s) => s.id) } },
        select: { studentId: true, amount: true },
    });
    const paidBy = new Map<string, number>();
    for (const p of payments) paidBy.set(p.studentId, round((paidBy.get(p.studentId) ?? 0) + p.amount));

    const rows = students.map((s) => {
        const due = s.monthlyFee ?? 0;
        const paid = paidBy.get(s.id) ?? 0;
        const status: DueStatus = paid >= due ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID';
        return { studentId: s.id, name: s.name, surname: s.surname, level: s.schoolLevel, groupIds: s.groupIds, parentPhone: s.parentPhone, due, paid, remaining: round(Math.max(0, due - paid)), status };
    });
    const expected = round(rows.reduce((sum, r) => sum + r.due, 0));
    const collected = round(rows.reduce((sum, r) => sum + Math.min(r.paid, r.due), 0));
    return { month, rows, totals: { expected, collected, remaining: round(expected - collected) } };
};

export const collectMonth = async (branchId: string, input: Record<string, any>) => {
    assertId('Student id', input.studentId);
    if (!isMonthKey(input.forMonth) || !isDueMonth(input.forMonth)) throw new Error('Choisissez un mois de septembre à juin');
    const amount = round(Number(input.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Montant invalide');
    const method = ['CASH', 'CHEQUE', 'VIREMENT', 'CARD'].includes(input.method) ? input.method : 'CASH';

    const student = await prisma.student.findFirst({ where: { id: input.studentId, branchId }, select: { id: true, name: true, surname: true, monthlyFee: true } });
    if (!student) throw new Error('Student not found');
    const already = round((await prisma.payment.findMany({ where: { studentId: student.id, forMonth: input.forMonth, ...TUITION }, select: { amount: true } })).reduce((s, p) => s + p.amount, 0));
    const left = round((student.monthlyFee ?? 0) - already);
    if (left <= 0) throw new Error('Ce mois est déjà payé');
    if (amount > left) throw new Error(`Il reste ${left} MAD à payer pour ce mois`);

    const payment = await prisma.payment.create({
        data: { studentId: student.id, branchId, amount, method, forMonth: input.forMonth, date: new Date(), note: `Mensualité ${input.forMonth}` },
    });
    await createTransaction({ type: 'INCOME', amount, category: 'Paiement Scolarité', branchId, description: `Mensualité ${input.forMonth} — ${student.name} ${student.surname} (${method})` });
    return payment;
};
