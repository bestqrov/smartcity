import type { OnboardingStepKey } from '@/lib/services/onboarding';

export const STEP_LABELS: Record<OnboardingStepKey, string> = {
    profile: "Profil de l'établissement",
    prices: 'Prix et frais de scolarité',
    formations: 'Formations',
    groups: 'Classes et groupes',
    teachers: 'Enseignants',
    staff: 'Staff (secrétaire)',
    transport: 'Transport',
    firstStudent: 'Premier élève',
};

export const STEP_HINTS: Record<OnboardingStepKey, string> = {
    profile: 'Nom, téléphone et, pour une école privée, les cycles.',
    prices: 'Les prix servent à chaque inscription.',
    formations: 'Créez vos formations avant les inscriptions.',
    groups: 'Les élèves sont inscrits dans un groupe ou une classe.',
    teachers: 'Ajoutez vos enseignants pour les affecter aux groupes.',
    staff: 'Un compte secrétaire pour l’accueil et les paiements.',
    transport: 'Véhicules et circuits, si vous proposez le transport.',
    firstStudent: 'Inscrivez un élève ou importez une liste Excel.',
};
