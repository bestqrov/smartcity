// School levels are stored in several spellings ("college", "COLLEGE", "Collège"): one display label for all.
const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const LEVEL_LABELS: Record<string, string> = { primaire: 'Primaire', college: 'Collège', lycee: 'Lycée' };

/** French label of a level (the i18n dictionary translates it); unknown values are returned as they are. */
export const levelLabel = (level?: string | null): string => (level ? LEVEL_LABELS[fold(level)] ?? level : '');
