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

// Arabic ordinals are bounded by spaces: «الاول» must not match inside «الاولي» or «التعليم الاولي».
const ar = (...words: string[]) => `(?:^|\\s)(?:${words.join('|')})(?=\\s|$)`;
const ORDINALS: [RegExp, number][] = [
    [new RegExp(`\\b(?:1|1er|1ere|premiere)\\b|${ar('الاولي', 'الاول')}`), 1],
    [new RegExp(`\\b(?:2|2e|2eme|deuxieme)\\b|${ar('الثانية', 'الثاني')}`), 2],
    [new RegExp(`\\b(?:3|3e|3eme|troisieme)\\b|${ar('الثالثة', 'الثالث')}`), 3],
    [new RegExp(`\\b(?:4|4e|4eme|quatrieme)\\b|${ar('الرابعة', 'الرابع')}`), 4],
    [new RegExp(`\\b(?:5|5e|5eme|cinquieme)\\b|${ar('الخامسة', 'الخامس')}`), 5],
    [new RegExp(`\\b(?:6|6e|6eme|sixieme)\\b|${ar('السادسة', 'السادس')}`), 6],
];

/** The ordinal written first in the text ("6ème année groupe 1" → 6). */
const firstOrdinal = (text: string): number | null => {
    let best: { index: number; n: number } | null = null;
    for (const [rx, n] of ORDINALS) {
        const m = rx.exec(text);
        if (m && (!best || m.index < best.index)) best = { index: m.index, n };
    }
    return best?.n ?? null;
};

const FRENCH_SHORT: Record<string, string> = {
    cp: 'P1', ce1: 'P2', ce2: 'P3', cm1: 'P4', cm2: 'P5',
    ps: 'PS1', 'petite section': 'PS1', ms: 'PS2', 'moyenne section': 'PS2', gs: 'PS3', 'grande section': 'PS3',
};

/** Level code from what a school writes ("3AP", "السنة الثالثة ابتدائي", "2ème année préscolaire"…); null when unknown. */
export function levelFromText(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const upper = raw.trim().toUpperCase();
    if (LEVEL_CODES.includes(upper)) return upper;
    const compact = upper.replace(/\s+/g, '');
    if (LEVEL_CODES.includes(compact)) return compact; // "P 3", "PS 2"
    const short = compact.match(/^([1-6])(AP|AC)$/);
    if (short) return short[2] === 'AP' ? `P${short[1]}` : Number(short[1]) <= 3 ? `C${short[1]}` : null;
    const apic = compact.match(/^([1-3])APIC$/);
    if (apic) return `C${apic[1]}`;
    const text = fold(raw).replace(/التعليم الاولي/g, 'prescolaire');
    const french = FRENCH_SHORT[text.replace(/^maternelle /, '')];
    if (french) return french;
    if (/tronc|جذع/.test(text) || /^tc[stl]?(\s|$)/.test(text)) return 'TC';
    const bac = text.match(/\b([12])\s*(ere|eme|e)?\s*(annee)?\s*bac\b|bac\s*([12])\b|(?:^|\s)([12])\s*باك|باك\s*([12])(?=\s|$)/);
    if (bac) return `B${bac[1] ?? bac[4] ?? bac[5] ?? bac[6]}`;
    if (/(?:^|\s)الاولي (باك|بكالوريا)/.test(text)) return 'B1';
    if (/(?:^|\s)الثانية (باك|بكالوريا)/.test(text)) return 'B2';
    const n = firstOrdinal(text);
    if (!n) return null;
    if (/prescolaire|maternelle|روض/.test(text)) return n <= 3 ? `PS${n}` : null;
    if (/primaire|ابتدائي|ابتداي/.test(text)) return `P${n}`;
    if (/college|اعدادي/.test(text)) return n <= 3 ? `C${n}` : null;
    return null;
}
