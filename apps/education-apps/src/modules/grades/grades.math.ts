// Pure grade arithmetic. Averages are kept unrounded; round only for display.

export interface MathGrade {
    studentId: string;
    score: number | null;
    absent: boolean;
}

export interface MathEvaluation {
    subject: string;
    maxScore: number;
    coefficient: number;
    published: boolean;
    grades: MathGrade[];
}

export const normalize = (score: number, max: number): number => (score / max) * 20;

export const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Σ(score/max*20 × coef) / Σ(coef) per subject, over the student's published, non-absent, scored grades.
 * Subjects where the student has no counted grade are omitted.
 */
export const subjectAverages = (evaluations: MathEvaluation[], studentId: string): Record<string, number> => {
    const sums: Record<string, { weighted: number; coef: number }> = {};
    for (const ev of evaluations) {
        if (!ev.published) continue;
        const grade = ev.grades.find((g) => g.studentId === studentId);
        if (!grade || grade.absent || grade.score === null || grade.score === undefined) continue;
        const acc = (sums[ev.subject] ??= { weighted: 0, coef: 0 });
        acc.weighted += normalize(grade.score, ev.maxScore) * ev.coefficient;
        acc.coef += ev.coefficient;
    }
    const result: Record<string, number> = {};
    for (const [subject, { weighted, coef }] of Object.entries(sums)) {
        if (coef > 0) result[subject] = weighted / coef;
    }
    return result;
};

/** Plain mean of the subject averages; null when there is none. */
export const generalAverage = (averages: Record<string, number>): number | null => {
    const values = Object.values(averages);
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
};

/** Competition ranking (1, 2, 2, 4) by general average, highest first; null averages stay unranked. */
export const rankStudents = (rows: { studentId: string; general: number | null }[]): Record<string, number | null> => {
    const ranks: Record<string, number | null> = {};
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const ranked = rows.filter((r) => r.general !== null).sort((a, b) => r2(b.general!) - r2(a.general!));
    ranked.forEach((row, i) => {
        ranks[row.studentId] = i > 0 && r2(ranked[i - 1].general!) === r2(row.general!) ? ranks[ranked[i - 1].studentId] : i + 1;
    });
    for (const row of rows) if (row.general === null) ranks[row.studentId] = null;
    return ranks;
};
