import { normalize, subjectAverages, generalAverage, rankStudents, round2 } from './grades.math';

const ev = (subject: string, maxScore: number, coefficient: number, published: boolean, grades: any[]) => ({
    subject,
    maxScore,
    coefficient,
    published,
    grades,
});

describe('grades.math', () => {
    it('normalize brings a score to /20', () => {
        expect(normalize(5, 10)).toBe(10);
        expect(normalize(15, 20)).toBe(15);
        expect(normalize(40, 100)).toBe(8);
    });

    it('subjectAverages weights by coefficient over different maxScore values', () => {
        const evals = [
            ev('Maths', 20, 1, true, [{ studentId: 's1', score: 10, absent: false }]),
            ev('Maths', 10, 2, true, [{ studentId: 's1', score: 10, absent: false }]), // 20/20 x2
        ];
        // (10*1 + 20*2) / 3 = 16.666...
        expect(subjectAverages(evals, 's1').Maths).toBeCloseTo(50 / 3);
    });

    it('ignores absent, unscored and unpublished grades, and other students', () => {
        const evals = [
            ev('Maths', 20, 1, true, [{ studentId: 's1', score: 12, absent: false }]),
            ev('Maths', 20, 5, true, [{ studentId: 's1', score: null, absent: true }]),
            ev('Maths', 20, 5, true, [{ studentId: 's1', score: null, absent: false }]),
            ev('Maths', 20, 5, false, [{ studentId: 's1', score: 0, absent: false }]),
            ev('Maths', 20, 5, true, [{ studentId: 's2', score: 0, absent: false }]),
            ev('Physique', 20, 1, true, [{ studentId: 's1', score: null, absent: true }]),
        ];
        expect(subjectAverages(evals, 's1')).toEqual({ Maths: 12 });
    });

    it('generalAverage is the plain mean of subject averages, null when none', () => {
        expect(generalAverage({ Maths: 12, Physique: 15 })).toBe(13.5);
        expect(generalAverage({})).toBeNull();
    });

    it('rankStudents uses competition ranking and leaves null averages unranked', () => {
        const ranks = rankStudents([
            { studentId: 'a', general: 12 },
            { studentId: 'b', general: 15 },
            { studentId: 'c', general: 12 },
            { studentId: 'd', general: null },
            { studentId: 'e', general: 10 },
        ]);
        expect(ranks).toEqual({ b: 1, a: 2, c: 2, e: 4, d: null });
    });

    it('round2 rounds for display only', () => {
        expect(round2(50 / 3)).toBe(16.67);
    });
});
