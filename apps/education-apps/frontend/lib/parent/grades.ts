import type { ParentGrade } from '@/types';

export interface SubjectAverage {
    subject: string;
    average: number | null;
    grades: ParentGrade[];
}

/** Score normalised to /20. */
const on20 = (g: ParentGrade) => ((g.score as number) / g.maxScore) * 20;

const counts = (g: ParentGrade) => !g.absent && g.score != null && g.maxScore > 0;

/** Weighted average (/20) of one subject's grades: Σ(score/max*20 × coef) / Σcoef, absentees excluded. */
export function subjectAverage(grades: ParentGrade[]): number | null {
    let sum = 0;
    let coefs = 0;
    for (const g of grades) {
        if (!counts(g)) continue;
        sum += on20(g) * g.coefficient;
        coefs += g.coefficient;
    }
    return coefs > 0 ? sum / coefs : null;
}

/** Per-subject averages for one period (subjects in order of first appearance, sorted by name). */
export function periodSubjects(grades: ParentGrade[], period: string): SubjectAverage[] {
    const bySubject = new Map<string, ParentGrade[]>();
    for (const g of grades) {
        if (g.period !== period) continue;
        bySubject.set(g.subject, [...(bySubject.get(g.subject) || []), g]);
    }
    return Array.from(bySubject.entries())
        .map(([subject, list]) => ({ subject, grades: list, average: subjectAverage(list) }))
        .sort((a, b) => a.subject.localeCompare(b.subject));
}

/** General average = mean of the subject averages that have one. */
export function generalAverage(subjects: SubjectAverage[]): number | null {
    const avgs = subjects.map((s) => s.average).filter((a): a is number => a != null);
    return avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
}

export const formatAverage = (n: number | null) => (n == null ? '–' : n.toFixed(2));

/** Latest period (in configured order) that has grades, else the first one. */
export function defaultPeriod(periods: string[], grades: ParentGrade[]): string | null {
    const withGrades = periods.filter((p) => grades.some((g) => g.period === p));
    return withGrades[withGrades.length - 1] ?? periods[0] ?? grades[0]?.period ?? null;
}

export function averageTone(avg: number | null): 'green' | 'amber' | 'red' | 'none' {
    if (avg == null) return 'none';
    return avg >= 14 ? 'green' : avg >= 10 ? 'amber' : 'red';
}
