// Moroccan private school levels. Keep in sync with frontend/lib/schoolLevels.ts.
export const CYCLES = ['PRESCOLAIRE', 'PRIMAIRE', 'COLLEGE', 'LYCEE'] as const;
export type Cycle = (typeof CYCLES)[number];

export const LEVELS_BY_CYCLE: Record<Cycle, string[]> = {
    PRESCOLAIRE: ['PS1', 'PS2', 'PS3'],
    PRIMAIRE: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
    COLLEGE: ['C1', 'C2', 'C3'],
    LYCEE: ['TC', 'B1', 'B2'],
};

export const LEVEL_CODES = CYCLES.flatMap((cycle) => LEVELS_BY_CYCLE[cycle]);

export const isCycle = (value: unknown): value is Cycle => typeof value === 'string' && (CYCLES as readonly string[]).includes(value);
export const isLevelCode = (value: unknown): value is string => typeof value === 'string' && LEVEL_CODES.includes(value);
export const levelCycle = (code: string): Cycle | null => CYCLES.find((cycle) => LEVELS_BY_CYCLE[cycle].includes(code)) ?? null;
export const isPrescolaire = (code: string | null | undefined) => !!code && LEVELS_BY_CYCLE.PRESCOLAIRE.includes(code);

/** Levels of the given cycles, in school order. */
export const levelsOfCycles = (cycles: readonly string[]): string[] => CYCLES.filter((c) => cycles.includes(c)).flatMap((c) => LEVELS_BY_CYCLE[c]);

const fold = (text: string) =>
    text
        .replace(/[إأآ]/g, 'ا') // before NFD, which would split these letters into alef + a combining hamza
        .replace(/ئ/g, 'ي')
        .replace(/ؤ/g, 'و')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Latin accents
        .replace(/[\u064B-\u065F\u0670]/g, '') // Arabic harakat and combining hamza
        .replace(/ى/g, 'ي')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

const ORDINALS: [RegExp, number][] = [
    [/\b(1|1er|1ere|premiere)\b|الاولى|الاول/, 1],
    [/\b(2|2e|2eme|deuxieme)\b|الثانية|الثاني/, 2],
    [/\b(3|3e|3eme|troisieme)\b|الثالثة|الثالث/, 3],
    [/\b(4|4e|4eme|quatrieme)\b|الرابعة|الرابع/, 4],
    [/\b(5|5e|5eme|cinquieme)\b|الخامسة|الخامس/, 5],
    [/\b(6|6e|6eme|sixieme)\b|السادسة|السادس/, 6],
];

/** Level code from what a school writes ("3AP", "السنة الثالثة ابتدائي", "2ème année préscolaire"…); null when unknown. */
export function levelFromText(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const upper = raw.trim().toUpperCase();
    if (LEVEL_CODES.includes(upper)) return upper;
    const compact = upper.replace(/\s+/g, '');
    const short = compact.match(/^([1-6])(AP|AC)$/);
    if (short) return short[2] === 'AP' ? `P${short[1]}` : Number(short[1]) <= 3 ? `C${short[1]}` : null;
    const text = fold(raw);
    if (/tronc|جذع/.test(text) || /^tc$/.test(text)) return 'TC';
    const bac = text.match(/\b([12])\s*(ere|eme|e)?\s*(annee)?\s*bac\b|bac\s*([12])\b/);
    if (bac) return `B${bac[1] ?? bac[4]}`;
    if (/الاولى باك/.test(text)) return 'B1';
    if (/الثانية باك/.test(text)) return 'B2';
    const n = ORDINALS.find(([rx]) => rx.test(text))?.[1];
    if (!n) return null;
    if (/prescolaire|maternelle|روض|التعليم الاولي/.test(text)) return n <= 3 ? `PS${n}` : null;
    if (/primaire|ابتدائي|ابتداي/.test(text)) return `P${n}`;
    if (/college|اعدادي/.test(text)) return n <= 3 ? `C${n}` : null;
    return null;
}
