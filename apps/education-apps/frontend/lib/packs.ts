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
