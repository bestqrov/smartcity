export type InstitutionType =
    | 'PRIVATE_SCHOOL'
    | 'TUTORING_CENTER'
    | 'VOCATIONAL_TRAINING'
    | 'LANGUAGE_CENTER'
    | 'CRECHE';

export const INSTITUTION_TYPES: InstitutionType[] = [
    'PRIVATE_SCHOOL',
    'TUTORING_CENTER',
    'VOCATIONAL_TRAINING',
    'LANGUAGE_CENTER',
    'CRECHE',
];

export const DEFAULT_INSTITUTION_TYPE: InstitutionType = 'PRIVATE_SCHOOL';

export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
    PRIVATE_SCHOOL: 'École privée',
    TUTORING_CENTER: 'Centre de soutien scolaire',
    VOCATIONAL_TRAINING: 'Formation professionnelle',
    LANGUAGE_CENTER: 'Centre de langues',
    CRECHE: 'Crèche / maternelle',
};

export const isInstitutionType = (value: unknown): value is InstitutionType =>
    typeof value === 'string' && (INSTITUTION_TYPES as string[]).includes(value);

// ---- sidebar adaptation ------------------------------------------------------------------------

export interface MenuItemLike {
    id: string;
    label: string;
    submenu?: { label: string; path: string }[];
}

interface InstitutionTypeConfig {
    hiddenMenuIds: string[];
    // Menu ids shown right after the pinned entries, in this order.
    menuOrderFirst: string[];
    menuLabels: Record<string, string>;
    // Sub-menu labels keyed by their path.
    subLabels: Record<string, string>;
    // Entries shown but not clickable yet.
    comingSoon: { id: string; label: string }[];
}

const NONE: InstitutionTypeConfig = {
    hiddenMenuIds: [],
    menuOrderFirst: [],
    menuLabels: {},
    subLabels: {},
    comingSoon: [],
};

// Adding a type or changing its menu is a change to this one object.
export const INSTITUTION_TYPE_CONFIG: Record<InstitutionType, InstitutionTypeConfig> = {
    PRIVATE_SCHOOL: NONE,
    TUTORING_CENTER: NONE,
    LANGUAGE_CENTER: NONE,
    VOCATIONAL_TRAINING: { ...NONE, menuOrderFirst: ['formation'] },
    CRECHE: {
        hiddenMenuIds: ['formation'],
        menuOrderFirst: [],
        menuLabels: { soutien: 'Enfants' },
        subLabels: {
            '/admin/soutien-scolaire': 'État des enfants',
            '/admin/students': 'Enfants',
            '/admin/groups': 'Sections',
        },
        comingSoon: [{ id: 'daily-log', label: 'Journal quotidien' }],
    },
};

// Always shown first, in their original order (owner/super-admin entries and the dashboard).
const PINNED_IDS = ['branches', 'schools', 'packs', 'dashboard'];

export const getInstitutionTypeConfig = (type?: InstitutionType | null): InstitutionTypeConfig =>
    INSTITUTION_TYPE_CONFIG[type ?? DEFAULT_INSTITUTION_TYPE] ?? NONE;

export function applyInstitutionType<T extends MenuItemLike>(items: T[], type?: InstitutionType | null): T[] {
    const config = getInstitutionTypeConfig(type);

    const rank = (id: string): number => {
        if (PINNED_IDS.includes(id)) return -1;
        const index = config.menuOrderFirst.indexOf(id);
        return index === -1 ? config.menuOrderFirst.length : index;
    };

    return items
        .filter((item) => !config.hiddenMenuIds.includes(item.id))
        .map((item) => ({
            ...item,
            label: config.menuLabels[item.id] ?? item.label,
            submenu: item.submenu?.map((sub) => ({ ...sub, label: config.subLabels[sub.path] ?? sub.label })),
        }))
        .sort((a, b) => rank(a.id) - rank(b.id)); // Array.prototype.sort is stable
}
