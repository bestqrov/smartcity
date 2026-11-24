// Turns a failed API call into a sentence that says why, instead of a generic "it failed".
// The texts are French source strings: pass the space's tr() to get them in the user's language.
type Tr = (text: string, params?: Record<string, string | number>) => string;

const KNOWN: Record<string, string> = {
    FEATURE_NOT_IN_PACK: "Cette fonction n'est pas incluse dans votre pack.",
    TRIAL_EXPIRED: "Votre période d'essai de 15 jours est terminée. Contactez-nous pour activer votre école.",
    'Insufficient permissions': "Votre compte n'a pas le droit de faire cette action (réservé au propriétaire ou à l'administrateur).",
    'A branch must be selected': 'Choisissez à nouveau votre établissement, puis réessayez.',
    'Branch does not belong to your school': 'Choisissez à nouveau votre établissement, puis réessayez.',
    // 403 of the whole /school-mode area for a school without cycles.
    "Le mode école privée n'est pas activé pour cet établissement": "Le mode école privée n'est pas activé pour cet établissement",
    'Student not found': 'Élève introuvable',
    'User has no assigned branch': "Votre compte n'est rattaché à aucun établissement. Contactez le propriétaire de l'école.",
};

// Server messages carrying a value: rebuilt from a French template so tr() can translate them.
const PATTERNS: Array<[RegExp, string, string]> = [
    [/^Il reste (.+) MAD à payer pour ce mois$/, 'Il reste {amount} MAD à payer pour ce mois', 'amount'],
    [/^La scolarité de cet élève commence en (.+)$/, 'La scolarité de cet élève commence en {month}', 'month'],
];

export function describeApiError(err: any, tr: Tr, fallback: string): string {
    if (err?.response === undefined && err?.request) return tr('Connexion au serveur impossible. Vérifiez votre connexion internet.');
    const code: string | undefined = err?.response?.data?.error;
    if (code && KNOWN[code]) return tr(KNOWN[code]);
    for (const [re, template, key] of PATTERNS) {
        const m = code ? re.exec(code) : null;
        if (m) return tr(template, { [key]: m[1] });
    }
    // Validation messages written for people (the server's 400 answers) are shown as they are.
    if (err?.response?.status === 400 && code) return tr(code);
    return tr(fallback);
}
