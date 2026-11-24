// src/modules/school-mode/dues.service.ts
import prisma from '../../config/database';
import { assertId } from '../transport/ids';
import { isDueMonth, isMonthKey } from './schoolYear';

export type DueStatus = 'PAID' | 'PARTIAL' | 'UNPAID';
export const METHODS = ['CASH', 'CHEQUE', 'VIREMENT', 'CARD'];
const round = (n: number) => Math.round(n * 100) / 100;
// Tuition months only: transport payments carry a transportSubscriptionId.
const TUITION = { OR: [{ transportSubscriptionId: null }, { transportSubscriptionId: { isSet: false } }] };

export const listDues = async (branchId: string, month: string) => {
    if (!isMonthKey(month)) throw new Error('Le mois doit être au format AAAA-MM');
    const empty = { month, rows: [] as any[], totals: { expected: 0, collected: 0, remaining: 0 } };
    if (!isDueMonth(month)) return empty;

    const students = await prisma.student.findMany({
        where: { branchId, active: true, monthlyFee: { gt: 0 } },
        select: { id: true, name: true, surname: true, schoolLevel: true, monthlyFee: true, parentPhone: true, groupIds: true, tuitionStartMonth: true },
        orderBy: [{ surname: 'asc' }, { name: 'asc' }],
    }).then((all) => all.filter((s) => !s.tuitionStartMonth || s.tuitionStartMonth <= month)); // not yet enrolled that month
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
    if (input.method !== undefined && input.method !== null && input.method !== '' && !METHODS.includes(input.method)) throw new Error('Mode de paiement invalide');
    const method = METHODS.includes(input.method) ? input.method : 'CASH';
    const forMonth: string = input.forMonth;

    const student = await prisma.student.findFirst({
        where: { id: input.studentId, branchId },
        select: { id: true, name: true, surname: true, monthlyFee: true, active: true, tuitionStartMonth: true },
    });
    if (!student) throw new Error('Student not found');
    if (student.active === false) throw new Error('Cet élève est inactif');
    const fee = student.monthlyFee ?? 0;
    if (!(fee > 0)) throw new Error('Aucune mensualité définie pour cet élève');
    if (student.tuitionStartMonth && forMonth < student.tuitionStartMonth) throw new Error(`La scolarité de cet élève commence en ${student.tuitionStartMonth}`);

    // Check and write in one transaction that also writes the student row: two concurrent
    // collections for the same student conflict in Mongo and one of them is retried/refused.
    return prisma.$transaction(async (tx) => {
        await tx.student.update({ where: { id: student.id }, data: { updatedAt: new Date() } });
        const already = round((await tx.payment.findMany({ where: { studentId: student.id, forMonth, ...TUITION }, select: { amount: true } })).reduce((s, p) => s + p.amount, 0));
        const left = round(fee - already);
        if (left <= 0) throw new Error('Ce mois est déjà payé');
        if (amount > left) throw new Error(`Il reste ${left} MAD à payer pour ce mois`);
        const date = new Date();
        const payment = await tx.payment.create({
            data: { studentId: student.id, branchId, amount, method, forMonth, date, note: `Mensualité ${forMonth}` },
        });
        await tx.transaction.create({
            data: { type: 'INCOME', amount, category: 'Paiement Scolarité', branchId, description: `Mensualité ${forMonth} — ${student.name} ${student.surname} (${method})`, date },
        });
        return payment;
    });
};
