export type PackFeature =
    | 'PARENT_PORTAL'
    | 'STUDENT_PORTAL'
    | 'QR_ATTENDANCE'
    | 'ANNOUNCEMENTS'
    | 'FINANCE_ANALYTICS'
    | 'TRANSPORT'
    | 'DAILY_LOG';

// Keep in sync with PACK_FEATURES in the backend (src/modules/packs/packs.constants.ts).
export const PACK_FEATURES: { key: PackFeature; label: string }[] = [
    { key: 'PARENT_PORTAL', label: 'Portail parents' },
    { key: 'STUDENT_PORTAL', label: 'Portail élève' },
    { key: 'QR_ATTENDANCE', label: 'Présence QR' },
    { key: 'ANNOUNCEMENTS', label: 'Annonces & vacances' },
    { key: 'FINANCE_ANALYTICS', label: 'Finance avancée' },
    { key: 'TRANSPORT', label: 'Transport scolaire' },
    { key: 'DAILY_LOG', label: 'Journal quotidien (crèche)' },
];

/** True when the school may use the option. `null`/`undefined` (no pack, or profile not loaded yet) means no restriction; the API checks again. */
export const hasFeature = (features: string[] | null | undefined, feature: PackFeature): boolean =>
    features == null || features.includes(feature);

// Pages that belong to a pack option, by path prefix (school and secretary spaces).
const FEATURE_PATHS: [string, PackFeature][] = [
    ['/admin/transport', 'TRANSPORT'],
    ['/admin/annonces', 'ANNOUNCEMENTS'],
    ['/admin/vacances', 'ANNOUNCEMENTS'],
    ['/admin/parents/access', 'PARENT_PORTAL'],
    ['/secretary/parents/access', 'PARENT_PORTAL'],
    ['/admin/attendance/scan', 'QR_ATTENDANCE'],
    ['/secretary/attendance/scan', 'QR_ATTENDANCE'],
    ['/admin/finance/transactions', 'FINANCE_ANALYTICS'],
    ['/secretary/finance/transactions', 'FINANCE_ANALYTICS'],
    ['/admin/finance/paiements', 'FINANCE_ANALYTICS'], // staff salaries
    ['/secretary/finance/paiements', 'FINANCE_ANALYTICS'],
];

export const featureForPath = (path: string | null | undefined): PackFeature | null =>
    (path && FEATURE_PATHS.find(([prefix]) => path === prefix || path.startsWith(prefix + '/'))?.[1]) || null;

// Sidebar entries (by menu id or sub-menu path) that need an option.
export const FEATURE_BY_MENU_ID: Record<string, PackFeature> = {
    transport: 'TRANSPORT',
    communication: 'ANNOUNCEMENTS',
    'parents-access': 'PARENT_PORTAL',
    'daily-log': 'DAILY_LOG',
};
