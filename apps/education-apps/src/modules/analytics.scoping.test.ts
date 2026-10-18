import prisma from '../config/database';
import { getStudentAnalytics } from './students/students.service';
import { getPaymentAnalytics } from './payments/payments.service';
import { getInscriptionAnalytics } from './inscriptions/inscriptions.service';
import { getFormationAnalytics } from './formations/formations.service';
import { getMonthlyTransactionStats } from './transactions/transactions.service';
import { calculateMonthlyTeacherExpenses } from './teachers/teachers.service';

jest.mock('../config/database', () => {
    const model = () => ({
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    });
    return {
        __esModule: true,
        default: {
            student: model(),
            inscription: model(),
            payment: model(),
            formation: model(),
            transaction: model(),
            teacher: model(),
        },
    };
});

// Every query an analytics function makes must be restricted to the caller's branch,
// otherwise one school sees the totals (and student names) of every other school.
const expectAllScoped = (branchId: string) => {
    const db = prisma as any;
    let calls = 0;
    for (const name of ['student', 'inscription', 'payment', 'formation', 'transaction', 'teacher']) {
        for (const method of ['count', 'findMany', 'aggregate']) {
            for (const [args] of db[name][method].mock.calls) {
                calls++;
                expect({ query: `${name}.${method}`, branchId: args?.where?.branchId }).toEqual({
                    query: `${name}.${method}`,
                    branchId,
                });
            }
        }
    }
    expect(calls).toBeGreaterThan(0);
};

describe('analytics are scoped to the branch', () => {
    afterEach(() => jest.clearAllMocks());

    it('getStudentAnalytics', async () => {
        await getStudentAnalytics('b1');
        expectAllScoped('b1');
    });

    it('getPaymentAnalytics (including the transaction and teacher helpers it calls)', async () => {
        await getPaymentAnalytics('b1');
        expectAllScoped('b1');
    });

    it('getInscriptionAnalytics', async () => {
        await getInscriptionAnalytics('b1');
        expectAllScoped('b1');
    });

    it('getFormationAnalytics', async () => {
        await getFormationAnalytics('b1');
        expectAllScoped('b1');
    });

    it('getMonthlyTransactionStats', async () => {
        await getMonthlyTransactionStats('b1');
        expectAllScoped('b1');
    });

    it('calculateMonthlyTeacherExpenses', async () => {
        await calculateMonthlyTeacherExpenses('b1');
        expectAllScoped('b1');
    });
});
