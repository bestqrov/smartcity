// src/modules/school-mode/dues.service.ts
import prisma from '../../config/database';
import { assertId } from '../transport/ids';
import { currentMonth, currentSchoolYear, dueMonthsBetween, isDueMonth, isMonthKey } from './schoolYear';

export type DueStatus = 'PAID' | 'PARTIAL' | 'UNPAID';
export const METHODS = ['CASH', 'CHEQUE', 'VIREMENT', 'CARD'];
const round = (n: number) => Math.round(n * 100) / 100;
// Tuition months only: transport payments carry a transportSubscriptionId.
const TUITION = { OR: [{ transportSubscriptionId: null }, { transportSubscriptionId: { isSet: false } }] };

export const listDues = async (branchId: string, month: string) => {
    if (!isMonthKey(month)) throw new Error('Le mois doit être au format AAAA-MM');
    const empty = { month, rows: [] as any[], totals: { expected: 0, collected: 0, remaining: 0 } };
    if (!isDueMonth(month)) return empty;

    // Students inactive now but paid for that month still count for it (no deactivation date is stored).
    const monthPayments = await prisma.payment.findMany({
        where: { branchId, forMonth: month, ...TUITION },
        select: { studentId: true, amount: true },
    });
    const paidIds = [...new Set(monthPayments.map((p) => p.studentId))];
    const students = await prisma.student.findMany({
        where: { branchId, monthlyFee: { gt: 0 }, OR: [{ active: true }, { id: { in: paidIds } }] },
        select: { id: true, name: true, surname: true, schoolLevel: true, monthlyFee: true, parentPhone: true, groupIds: true, tuitionStartMonth: true },
        orderBy: [{ surname: 'asc' }, { name: 'asc' }],
    }).then((all) => all.filter((s) => !s.tuitionStartMonth || s.tuitionStartMonth <= month)); // not yet enrolled that month
    const listed = new Set(students.map((s) => s.id));
    const payments = monthPayments.filter((p) => listed.has(p.studentId));
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

/**
 * Everything still owed today by active school-mode students: unpaid months from
 * max(tuitionStartMonth, start of the school year) to the current month (Sept–June, Morocco time),
 * plus unpaid inscription balances (inscriptions − tuition payments without a month).
 */
export const duesSummary = async (branchId: string, now = new Date()) => {
    const yearStart = `${currentSchoolYear(now).slice(0, 4)}-09`;
    const thisMonth = currentMonth(now);
    const students = await prisma.student.findMany({
        where: { branchId, active: true, monthlyFee: { gt: 0 } },
        select: { id: true, monthlyFee: true, tuitionStartMonth: true },
    });
    const ids = students.map((s) => s.id);
    if (!ids.length) return { unpaid: 0, months: 0, inscriptions: 0 };
    const [payments, inscriptions] = await Promise.all([
        prisma.payment.findMany({ where: { branchId, studentId: { in: ids }, ...TUITION }, select: { studentId: true, amount: true, forMonth: true } }),
        prisma.inscription.findMany({ where: { branchId, studentId: { in: ids } }, select: { studentId: true, amount: true } }),
    ]);
    const byMonth = new Map<string, number>();
    const feesPaid = new Map<string, number>();
    for (const p of payments) {
        if (p.forMonth) byMonth.set(`${p.studentId}|${p.forMonth}`, (byMonth.get(`${p.studentId}|${p.forMonth}`) ?? 0) + p.amount);
        else feesPaid.set(p.studentId, (feesPaid.get(p.studentId) ?? 0) + p.amount);
    }
    const feesDue = new Map<string, number>();
    for (const i of inscriptions) feesDue.set(i.studentId, (feesDue.get(i.studentId) ?? 0) + i.amount);

    let months = 0;
    let fees = 0;
    for (const s of students) {
        const from = s.tuitionStartMonth && s.tuitionStartMonth > yearStart ? s.tuitionStartMonth : yearStart;
        for (const m of dueMonthsBetween(from, thisMonth)) months += Math.max(0, (s.monthlyFee ?? 0) - (byMonth.get(`${s.id}|${m}`) ?? 0));
        fees += Math.max(0, (feesDue.get(s.id) ?? 0) - (feesPaid.get(s.id) ?? 0));
    }
    return { unpaid: round(months + fees), months: round(months), inscriptions: round(fees) };
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
