import prisma from '../../config/database';
import {
    createParent,
    regenerateParentToken,
    getParentByRawToken,
    getAllParents,
    getParentById,
    updateParent,
    assertParentInBranch,
    issueParentLinks,
    getParentsAccess,
} from './parents.service';
import * as accessToken from '../../utils/accessToken';
import { currentMonth } from '../transport/month';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        parent: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
        announcement: { findMany: jest.fn() },
        holiday: { findMany: jest.fn() },
        branch: { findUnique: jest.fn() },
        accessLog: { groupBy: jest.fn() },
        grade: { findMany: jest.fn() },
        settings: { findUnique: jest.fn() },
        $transaction: jest.fn(),
    },
}));

describe('parents.service', () => {
    afterEach(() => jest.clearAllMocks());

    it('createParent stores a hash, not the raw token, and returns the raw token once', async () => {
        (prisma.parent.create as jest.Mock).mockResolvedValue({ id: 'p1', name: 'Fatima' });

        const result = await createParent({ name: 'Fatima', phone: '0600000000', branchId: 'b1' });

        expect(prisma.parent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                name: 'Fatima',
                phone: '0600000000',
                branchId: 'b1',
                accessTokenHash: expect.any(String),
                linkIssuedAt: expect.any(Date),
            }),
        });
        expect(result.rawToken).toEqual(expect.any(String));
        expect(result.parent).toEqual({ id: 'p1', name: 'Fatima' });
    });

    it('regenerateParentToken overwrites the stored hash and returns a new raw token', async () => {
        (prisma.parent.findFirst as jest.Mock).mockResolvedValue({ id: 'p1', branchId: 'b1' });
        (prisma.parent.update as jest.Mock).mockResolvedValue({ id: 'p1' });

        const result = await regenerateParentToken('p1', 'b1');

        expect(prisma.parent.update).toHaveBeenCalledWith({
            where: { id: 'p1' },
            data: { accessTokenHash: expect.any(String), linkIssuedAt: expect.any(Date) },
        });
        expect(result.rawToken).toEqual(expect.any(String));
    });

    it('getParentByRawToken returns null for a token that matches no stored hash', async () => {
        (prisma.parent.findUnique as jest.Mock).mockResolvedValue(null);

        const result = await getParentByRawToken('bad-token');

        expect(result).toBeNull();
        expect(prisma.announcement.findMany).not.toHaveBeenCalled();
    });

    describe('getParentByRawToken profile', () => {
        beforeEach(() => {
            (prisma.announcement.findMany as jest.Mock).mockResolvedValue([{ id: 'a1' }]);
            (prisma.holiday.findMany as jest.Mock).mockResolvedValue([{ id: 'h1' }]);
            (prisma.grade.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.branch.findUnique as jest.Mock).mockResolvedValue({ school: { name: 'Ecole', logo: null, phone: '05', email: 'e@x' } });
        });

        it('selects the new student fields: groups with only the teacher name, attendances of the last 60 days', async () => {
            (prisma.parent.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', branchId: 'b1', students: [] });
            const before = Date.now();

            await getParentByRawToken('tok');

            const arg = (prisma.parent.findUnique as jest.Mock).mock.calls[0][0];
            const include = arg.include.students.include;
            expect(include.inscriptions).toBe(true);
            expect(include.payments).toEqual({ where: { OR: [{ transportSubscriptionId: null }, { transportSubscriptionId: { isSet: false } }] } });
            expect(include.groups).toEqual({
                select: { id: true, name: true, subject: true, level: true, timeSlots: true, teacher: { select: { name: true } } },
            });
            expect(include.attendances.select).toEqual({ id: true, date: true, slotStart: true, status: true, groupId: true, scannedAt: true });
            expect(include.attendances.orderBy).toEqual([{ date: 'desc' }, { slotStart: 'desc' }]);
            const gte: Date = include.attendances.where.date.gte;
            const days = (before - gte.getTime()) / 86400000;
            expect(days).toBeGreaterThan(59.99);
            expect(days).toBeLessThan(60.01);
            expect(include.transportSubscriptions.where).toEqual({ status: { in: ['ACTIVE', 'PAUSED'] } });
            expect(include.transportSubscriptions.include.payments).toEqual({ where: { forMonth: currentMonth() }, select: { id: true } });
        });

        it('adds announcements, holidays and school from the parent’s branch', async () => {
            (prisma.parent.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', branchId: 'b1', students: [] });

            const result: any = await getParentByRawToken('tok');

            expect(prisma.announcement.findMany).toHaveBeenCalledWith({
                where: { branchId: 'b1', active: true },
                orderBy: { createdAt: 'desc' },
                take: 10,
            });
            expect(prisma.holiday.findMany).toHaveBeenCalledWith({
                where: { branchId: 'b1', active: true, endDate: { gte: expect.any(Date) } },
                orderBy: { startDate: 'asc' },
            });
            expect(prisma.branch.findUnique).toHaveBeenCalledWith({
                where: { id: 'b1' },
                include: { school: { select: { name: true, logo: true, phone: true, email: true } } },
            });
            expect(result.announcements).toEqual([{ id: 'a1' }]);
            expect(result.holidays).toEqual([{ id: 'h1' }]);
            expect(result.school).toEqual({ name: 'Ecole', logo: null, phone: '05', email: 'e@x' });
        });

        it('drops students that belong to another branch', async () => {
            (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
                id: 'p1',
                branchId: 'b1',
                students: [{ id: 's1', branchId: 'b1' }, { id: 's2', branchId: 'b2' }],
            });

            const result: any = await getParentByRawToken('tok');

            expect(result.students.map((s: any) => s.id)).toEqual(['s1']);
        });

        it('gives a parent without a branch empty lists and no school', async () => {
            (prisma.parent.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', branchId: null, students: [] });

            const result: any = await getParentByRawToken('tok');

            expect(result.announcements).toEqual([]);
            expect(result.holidays).toEqual([]);
            expect(result.school).toBeNull();
            expect(prisma.announcement.findMany).not.toHaveBeenCalled();
            expect(prisma.holiday.findMany).not.toHaveBeenCalled();
            expect(prisma.branch.findUnique).not.toHaveBeenCalled();
            expect(result.gradingPeriods).toEqual(['Semestre 1', 'Semestre 2']);
            expect(prisma.grade.findMany).not.toHaveBeenCalled();
        });

        it('gives each child only published grades, newest first, and the branch grading periods', async () => {
            (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
                id: 'p1',
                branchId: 'b1',
                students: [{ id: 's1', branchId: 'b1' }, { id: 's2', branchId: 'b1' }],
            });
            (prisma.settings.findUnique as jest.Mock).mockResolvedValue({ gradingPeriods: ['T1', 'T2', 'T3'] });
            const evaluation = (id: string, date: string) => ({
                id,
                title: 'Contrôle ' + id,
                subject: 'Maths',
                period: 'T1',
                date: new Date(date),
                maxScore: 20,
                coefficient: 2,
                published: true,
                branchId: 'b1',
                groupId: 'g1',
            });
            (prisma.grade.findMany as jest.Mock).mockResolvedValue([
                { id: 'gr1', studentId: 's1', score: 14, absent: false, comment: 'Bien', evaluationId: 'e1', evaluation: evaluation('e1', '2026-10-01') },
                { id: 'gr2', studentId: 's1', score: null, absent: true, comment: null, evaluationId: 'e2', evaluation: evaluation('e2', '2026-11-01') },
            ]);

            const result: any = await getParentByRawToken('tok');

            expect(prisma.grade.findMany).toHaveBeenCalledWith({
                where: {
                    branchId: 'b1',
                    studentId: { in: ['s1', 's2'] },
                    evaluation: { is: { published: true, branchId: 'b1' } },
                    OR: [{ absent: true }, { score: { not: null } }],
                },
                include: { evaluation: true },
            });
            expect(result.gradingPeriods).toEqual(['T1', 'T2', 'T3']);
            expect(result.students[0].grades).toEqual([
                { evaluationId: 'e2', title: 'Contrôle e2', subject: 'Maths', period: 'T1', date: new Date('2026-11-01'), maxScore: 20, coefficient: 2, score: null, absent: true, comment: null },
                { evaluationId: 'e1', title: 'Contrôle e1', subject: 'Maths', period: 'T1', date: new Date('2026-10-01'), maxScore: 20, coefficient: 2, score: 14, absent: false, comment: 'Bien' },
            ]);
            expect(result.students[1].grades).toEqual([]);
        });

        it('drops cleared grades (no score, not absent)', async () => {
            (prisma.parent.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', branchId: 'b1', students: [{ id: 's1', branchId: 'b1' }] });
            (prisma.settings.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.grade.findMany as jest.Mock).mockResolvedValue([
                { studentId: 's1', score: null, absent: false, comment: null, evaluationId: 'e1', evaluation: { id: 'e1', published: true, branchId: 'b1', date: new Date() } },
            ]);
            const result: any = await getParentByRawToken('tok');
            expect(result.students[0].grades).toEqual([]);
        });

        it('never exposes a grade of an unpublished evaluation even if the query returned one', async () => {
            (prisma.parent.findUnique as jest.Mock).mockResolvedValue({ id: 'p1', branchId: 'b1', students: [{ id: 's1', branchId: 'b1' }] });
            (prisma.settings.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.grade.findMany as jest.Mock).mockResolvedValue([
                { studentId: 's1', score: 3, absent: false, comment: null, evaluationId: 'e9', evaluation: { id: 'e9', published: false, branchId: 'b1' } },
            ]);

            const result: any = await getParentByRawToken('tok');

            expect(result.students[0].grades).toEqual([]);
            expect(result.gradingPeriods).toEqual(['Semestre 1', 'Semestre 2']);
        });
    });
});

describe('issueParentLinks', () => {
    afterEach(() => jest.clearAllMocks());

    beforeEach(() => {
        (prisma.parent.update as jest.Mock).mockImplementation((args: any) => ({ op: 'update', args }));
        (prisma.$transaction as jest.Mock).mockImplementation(async (ops: any[]) => ops);
    });

    it('rejects an empty list, more than 200 ids, duplicates, and non-string ids', async () => {
        await expect(issueParentLinks([], 'b1')).rejects.toThrow();
        await expect(issueParentLinks(Array.from({ length: 201 }, (_, i) => `p${i}`), 'b1')).rejects.toThrow();
        await expect(issueParentLinks(['p1', 'p1'], 'b1')).rejects.toThrow();
        await expect(issueParentLinks(['p1', ''], 'b1')).rejects.toThrow();
        await expect(issueParentLinks(['p1', 5 as any], 'b1')).rejects.toThrow();
        await expect(issueParentLinks('p1' as any, 'b1')).rejects.toThrow();
        expect(prisma.parent.findMany).not.toHaveBeenCalled();
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('accepts exactly 200 ids', async () => {
        const ids = Array.from({ length: 200 }, (_, i) => `p${i}`);
        (prisma.parent.findMany as jest.Mock).mockResolvedValue(ids.map((id) => ({ id })));

        const result = await issueParentLinks(ids, 'b1');

        expect(result).toHaveLength(200);
    });

    it('writes nothing when one id is not in the branch', async () => {
        (prisma.parent.findMany as jest.Mock).mockResolvedValue([{ id: 'p1' }]);

        await expect(issueParentLinks(['p1', 'p-other'], 'b1')).rejects.toThrow('Parent not found');
        expect(prisma.parent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: { in: ['p1', 'p-other'] }, branchId: 'b1' } })
        );
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.parent.update).not.toHaveBeenCalled();
    });

    it('treats a malformed id as not found', async () => {
        (prisma.parent.findMany as jest.Mock).mockRejectedValue(new Error('Malformed ObjectID'));

        await expect(issueParentLinks(['bad'], 'b1')).rejects.toThrow('Parent not found');
    });

    it('regenerates every token in one transaction, sets linkIssuedAt, and returns raw tokens matching the stored hashes', async () => {
        (prisma.parent.findMany as jest.Mock).mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);

        const result = await issueParentLinks(['p1', 'p2'], 'b1');

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        const calls = (prisma.parent.update as jest.Mock).mock.calls.map((c) => c[0]);
        expect(calls).toHaveLength(2);
        expect(result.map((r) => r.id)).toEqual(['p1', 'p2']);
        result.forEach((r, i) => {
            expect(calls[i].where).toEqual({ id: r.id });
            expect(calls[i].data.linkIssuedAt).toEqual(expect.any(Date));
            expect(calls[i].data.accessTokenHash).toBe(accessToken.hashToken(r.rawToken));
        });
        expect(result[0].rawToken).not.toBe(result[1].rawToken);
    });
});

describe('getParentsAccess', () => {
    afterEach(() => jest.clearAllMocks());

    it('lists the branch’s parents with children and builds lastVisitAt from one groupBy', async () => {
        const issued = new Date('2026-11-01');
        (prisma.parent.findMany as jest.Mock).mockResolvedValue([
            { id: 'p2', name: 'Zahra', phone: '2', whatsapp: null, linkIssuedAt: null, students: [] },
            { id: 'p1', name: 'Amal', phone: '1', whatsapp: '1w', linkIssuedAt: issued, students: [{ id: 's1', name: 'Ali', surname: 'B' }] },
        ]);
        const visit = new Date('2026-11-10');
        (prisma.accessLog.groupBy as jest.Mock).mockResolvedValue([{ parentId: 'p1', _max: { accessedAt: visit } }]);

        const result = await getParentsAccess('b1');

        expect(prisma.parent.findMany).toHaveBeenCalledWith({
            where: { branchId: 'b1' },
            select: {
                id: true,
                name: true,
                phone: true,
                whatsapp: true,
                linkIssuedAt: true,
                students: { where: { branchId: 'b1' }, select: { id: true, name: true, surname: true } },
            },
        });
        expect(prisma.accessLog.groupBy).toHaveBeenCalledTimes(1);
        expect(prisma.accessLog.groupBy).toHaveBeenCalledWith({
            by: ['parentId'],
            where: { parentId: { in: ['p2', 'p1'] } },
            _max: { accessedAt: true },
        });
        expect(result).toEqual([
            { id: 'p1', name: 'Amal', phone: '1', whatsapp: '1w', linkIssuedAt: issued, lastVisitAt: visit, children: [{ id: 's1', name: 'Ali', surname: 'B' }] },
            { id: 'p2', name: 'Zahra', phone: '2', whatsapp: null, linkIssuedAt: null, lastVisitAt: null, children: [] },
        ]);
    });

    it('skips the aggregation when the branch has no parents', async () => {
        (prisma.parent.findMany as jest.Mock).mockResolvedValue([]);

        expect(await getParentsAccess('b1')).toEqual([]);
        expect(prisma.accessLog.groupBy).not.toHaveBeenCalled();
    });
});

describe('parents are scoped to a branch', () => {
    afterEach(() => jest.clearAllMocks());

    it('lists only the branch’s parents, with only the branch’s children', async () => {
        (prisma.parent.findMany as jest.Mock).mockResolvedValue([]);

        await getAllParents('b1');

        expect(prisma.parent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { branchId: 'b1' },
                include: { students: { where: { branchId: 'b1' } } },
            })
        );
    });

    it('does not show another school’s parent', async () => {
        (prisma.parent.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(getParentById('p-other', 'b1')).rejects.toThrow('Parent not found');
        expect(prisma.parent.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'p-other', branchId: 'b1' } })
        );
    });

    it('refuses to re-issue another school’s parent link, leaving their current link working', async () => {
        (prisma.parent.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(regenerateParentToken('p-other', 'b1')).rejects.toThrow('Parent not found');
        expect(prisma.parent.update).not.toHaveBeenCalled();
    });

    it('refuses to edit another school’s parent', async () => {
        (prisma.parent.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(updateParent('p-other', 'b1', { phone: '0700000000' })).rejects.toThrow('Parent not found');
        expect(prisma.parent.update).not.toHaveBeenCalled();
    });

    it('never lets an edit move a parent to another branch or change its access hash', async () => {
        (prisma.parent.findFirst as jest.Mock).mockResolvedValue({ id: 'p1', branchId: 'b1' });
        (prisma.parent.update as jest.Mock).mockResolvedValue({ id: 'p1' });

        await updateParent('p1', 'b1', { phone: '0700000000', branchId: 'b2', accessTokenHash: 'x' } as any);

        const { data } = (prisma.parent.update as jest.Mock).mock.calls[0][0];
        expect(data.phone).toBe('0700000000');
        expect(data).not.toHaveProperty('branchId', 'b2');
        expect(data.accessTokenHash).toBeUndefined();
    });

    it('treats a malformed id as not found', async () => {
        (prisma.parent.findFirst as jest.Mock).mockRejectedValue(new Error('Malformed ObjectID'));

        await expect(assertParentInBranch('not-an-id', 'b1')).rejects.toThrow('Parent not found');
    });

    it('allows unlinking (no parent)', async () => {
        await expect(assertParentInBranch(null, 'b1')).resolves.toBeUndefined();
        expect(prisma.parent.findFirst).not.toHaveBeenCalled();
    });
});
