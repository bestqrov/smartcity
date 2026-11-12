// frontend/lib/packs/limits.ts
import type { Messages } from '@/lib/landing/messages';
import type { InstitutionType } from '@/lib/institutionTypes';
import type { PublicPack } from '@/lib/services/packs';

const fill = (template: string, n: number) => template.replace('{n}', String(n));

// "Jusqu'à 300 élèves · 2 établissements": shared by the landing pricing cards and the in-app upgrade dialog.
export const limitsLine = (pack: Pick<PublicPack, 'maxStudents' | 'maxBranches'>, type: InstitutionType, m: Messages): string => {
    const creche = type === 'CRECHE';
    const students =
        pack.maxStudents === null
            ? creche ? m.lim_children_unlimited : m.lim_students_unlimited
            : fill(creche ? m.lim_children : m.lim_students, pack.maxStudents);
    const branches =
        pack.maxBranches === null
            ? m.lim_branches_unlimited
            : pack.maxBranches === 1
            ? m.lim_branch_one
            : pack.maxBranches === 2
            ? m.lim_branches_two
            : fill(m.lim_branches, pack.maxBranches);
    return `${students} · ${branches}`;
};

export interface StudentLimitDetails {
    limit: number;
    current: number;
    adding: number;
    packName: string | null;
}

export const missingPlaces = (d: StudentLimitDetails) => Math.max(0, d.current + d.adding - d.limit);

export const studentLimitMessage = (d: StudentLimitDetails): string => {
    const pack = d.packName ? `Votre pack « ${d.packName} »` : 'Votre pack';
    const adding = d.adding === 1 ? 'vous voulez en ajouter 1' : `vous voulez en ajouter ${d.adding}`;
    const missing = missingPlaces(d);
    return `${pack} permet ${d.limit} élèves. Vous en avez ${d.current}, ${adding} : il manque ${missing} place${missing > 1 ? 's' : ''}.`;
};
