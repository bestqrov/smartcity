// Moroccan private school levels. Keep in sync with src/modules/school-mode/levels.ts.
export type Cycle = 'PRESCOLAIRE' | 'PRIMAIRE' | 'COLLEGE' | 'LYCEE';
export const CYCLES: { key: Cycle; label: string }[] = [
    { key: 'PRESCOLAIRE', label: 'Préscolaire' },
    { key: 'PRIMAIRE', label: 'Primaire' },
    { key: 'COLLEGE', label: 'Collège' },
    { key: 'LYCEE', label: 'Lycée' },
];
export const LEVELS: { code: string; cycle: Cycle; label: string }[] = [
    { code: 'PS1', cycle: 'PRESCOLAIRE', label: '1ère année préscolaire' },
    { code: 'PS2', cycle: 'PRESCOLAIRE', label: '2ème année préscolaire' },
    { code: 'PS3', cycle: 'PRESCOLAIRE', label: '3ème année préscolaire' },
    { code: 'P1', cycle: 'PRIMAIRE', label: '1ère année primaire' },
    { code: 'P2', cycle: 'PRIMAIRE', label: '2ème année primaire' },
    { code: 'P3', cycle: 'PRIMAIRE', label: '3ème année primaire' },
    { code: 'P4', cycle: 'PRIMAIRE', label: '4ème année primaire' },
    { code: 'P5', cycle: 'PRIMAIRE', label: '5ème année primaire' },
    { code: 'P6', cycle: 'PRIMAIRE', label: '6ème année primaire' },
    { code: 'C1', cycle: 'COLLEGE', label: '1ère année collège' },
    { code: 'C2', cycle: 'COLLEGE', label: '2ème année collège' },
    { code: 'C3', cycle: 'COLLEGE', label: '3ème année collège' },
    { code: 'TC', cycle: 'LYCEE', label: 'Tronc commun' },
    { code: 'B1', cycle: 'LYCEE', label: '1ère année Bac' },
    { code: 'B2', cycle: 'LYCEE', label: '2ème année Bac' },
];
// French name of a school-mode level code (PS2 → « 2ème année préscolaire »); other text is returned as is.
export const levelLabel = (raw: string): string => LEVELS.find((l) => l.code === raw)?.label ?? raw;
export const levelsOfCycles = (cycles: string[]) => LEVELS.filter((l) => cycles.includes(l.cycle));
export const isPrescolaire = (code?: string | null) => !!code && LEVELS.some((l) => l.code === code && l.cycle === 'PRESCOLAIRE');
export const DOCUMENT_CHECKLIST: { key: string; label: string; prescolaireOnly?: boolean }[] = [
    { key: 'BIRTH_CERT', label: "Extrait d'acte de naissance" },
    { key: 'PHOTOS', label: "Photos d'identité" },
    { key: 'LEAVING_CERT', label: 'Certificat de départ' },
    { key: 'LAST_REPORT', label: 'Dernier bulletin' },
    { key: 'PARENT_CIN', label: 'Copie CIN du parent' },
    { key: 'VACCINATION', label: 'Carnet de vaccination', prescolaireOnly: true },
];
