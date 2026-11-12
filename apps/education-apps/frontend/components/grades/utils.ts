import type { EvaluationWithGrades, GradeStudent } from '@/lib/services/grades';

/** "12,5" → 12.5; "" → null; anything else → NaN. */
export const parseScore = (raw: string): number | null => {
    const t = raw.trim().replace(',', '.');
    if (t === '') return null;
    if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
    return Number(t);
};

export const formatNum = (n: number | null | undefined, digits = 2): string =>
    n === null || n === undefined || Number.isNaN(n) ? '—' : n.toFixed(digits).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '').replace('.', ',');

export const fixed2 = (n: number | null | undefined): string =>
    n === null || n === undefined ? '—' : n.toFixed(2).replace('.', ',');

export const sortStudents = <T extends GradeStudent>(students: T[]): T[] =>
    [...students].sort(
        (a, b) => a.surname.localeCompare(b.surname, 'fr') || a.name.localeCompare(b.name, 'fr'),
    );

export const evaluationStats = (ev: EvaluationWithGrades, studentCount: number) => {
    const scored = ev.grades.filter((g) => !g.absent && g.score !== null);
    const entered = ev.grades.filter((g) => g.absent || g.score !== null).length;
    const average = scored.length ? scored.reduce((s, g) => s + (g.score as number), 0) / scored.length : null;
    return { entered, total: studentCount, average };
};

export const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const formatDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};
