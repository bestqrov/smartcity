// frontend/lib/import/fields.ts
// The import's target fields (keys match the backend's ImportRow) and the header names schools use.
// Grow SYNONYMS as real school files come in.

export type ImportFieldKey =
    | 'surname' | 'name' | 'fullName' | 'birthDate' | 'birthPlace' | 'schoolLevel' | 'group' | 'currentSchool'
    | 'massarNumber' | 'cin' | 'address' | 'phone' | 'email' | 'fatherName' | 'motherName' | 'parentName'
    | 'parentRelation' | 'parentPhone' | 'crecheSection' | 'healthNotes';

export interface ImportFieldDef {
    key: ImportFieldKey;
    label: string; // French template header
    hint: string; // Arabic hint shown under the header
    example: string;
    crecheOnly?: boolean;
}

export const IMPORT_FIELDS: ImportFieldDef[] = [
    { key: 'surname', label: 'Nom', hint: 'النسب', example: 'Bennani' },
    { key: 'name', label: 'Prénom', hint: 'الاسم', example: 'Omar' },
    { key: 'fullName', label: 'Nom complet', hint: 'الاسم الكامل', example: '' },
    { key: 'birthDate', label: 'Date de naissance', hint: 'تاريخ الازدياد', example: '05/03/2015' },
    { key: 'birthPlace', label: 'Lieu de naissance', hint: 'مكان الازدياد', example: 'Rabat' },
    { key: 'schoolLevel', label: 'Niveau', hint: 'المستوى', example: 'Primaire' },
    { key: 'group', label: 'Groupe / Classe', hint: 'القسم / الفوج', example: 'CE2-A' },
    { key: 'currentSchool', label: 'École actuelle', hint: 'المدرسة الحالية', example: '' },
    { key: 'massarNumber', label: 'Code Massar', hint: 'رمز مسار', example: 'J130000001' },
    { key: 'cin', label: 'CIN', hint: 'رقم البطاقة الوطنية', example: '' },
    { key: 'address', label: 'Adresse', hint: 'العنوان', example: '' },
    { key: 'phone', label: 'Téléphone élève', hint: 'هاتف التلميذ', example: '' },
    { key: 'email', label: 'Email', hint: 'البريد الإلكتروني', example: '' },
    { key: 'fatherName', label: 'Nom du père', hint: 'اسم الأب', example: 'Ahmed Bennani' },
    { key: 'motherName', label: 'Nom de la mère', hint: 'اسم الأم', example: 'Fatima Alaoui' },
    { key: 'parentName', label: 'Nom du tuteur', hint: 'اسم ولي الأمر', example: 'Ahmed Bennani' },
    { key: 'parentRelation', label: 'Lien de parenté', hint: 'صفة ولي الأمر', example: 'Père' },
    { key: 'parentPhone', label: 'Téléphone tuteur', hint: 'هاتف ولي الأمر', example: '0612345678' },
    { key: 'crecheSection', label: 'Section crèche', hint: 'قسم الحضانة', example: '', crecheOnly: true },
    { key: 'healthNotes', label: 'Notes de santé', hint: 'ملاحظات صحية', example: '', crecheOnly: true },
];

export const fieldsFor = (creche: boolean) => IMPORT_FIELDS.filter((field) => creche || !field.crecheOnly);

// Lowercase, no Latin accents, no Arabic diacritics/tatweel, unified alef, no punctuation, single spaces.
// Built from a string: the project's TS target (es5) rejects the u flag in a regex literal.
const NON_WORD = new RegExp('[^\\p{L}\\p{N}]+', 'gu');

export const foldHeader = (value: string): string =>
    value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[ً-ْـ]/g, '')
        .replace(/[أإآ]/g, 'ا')
        .toLowerCase()
        .replace(NON_WORD, ' ')
        .trim();

const SYNONYMS: Record<ImportFieldKey, string[]> = {
    surname: ['nom', 'nom eleve', 'nom de famille', 'family name', 'last name', 'النسب', 'الاسم العائلي', 'اسم العائلة'],
    name: ['prenom', 'prenom eleve', 'first name', 'الاسم', 'الاسم الشخصي'],
    fullName: ['nom et prenom', 'nom prenom', 'nom complet', 'eleve', 'full name', 'الاسم الكامل', 'الاسم و النسب', 'الاسم والنسب', 'التلميذ'],
    birthDate: ['date de naissance', 'date naissance', 'ddn', 'ne le', 'nee le', 'naissance', 'birth date', 'date of birth', 'تاريخ الازدياد', 'تاريخ الولادة'],
    birthPlace: ['lieu de naissance', 'lieu naissance', 'ne a', 'place of birth', 'مكان الازدياد', 'مكان الولادة'],
    schoolLevel: ['niveau', 'niveau scolaire', 'cycle', 'level', 'المستوى', 'المستوى الدراسي'],
    group: ['classe', 'groupe', 'class', 'group', 'section', 'القسم', 'الفوج', 'الفصل'],
    currentSchool: ['ecole actuelle', 'ecole', 'etablissement', 'etablissement actuel', 'school', 'المدرسة', 'المؤسسة'],
    massarNumber: ['code massar', 'massar', 'cne', 'n massar', 'numero massar', 'رمز مسار', 'مسار', 'الرمز'],
    cin: ['cin', 'cni', 'carte nationale', 'البطاقة الوطنية', 'رقم البطاقة الوطنية'],
    address: ['adresse', 'address', 'العنوان'],
    phone: ['telephone eleve', 'tel eleve', 'gsm eleve', 'telephone', 'tel', 'gsm', 'phone', 'الهاتف', 'هاتف التلميذ'],
    email: ['email', 'e mail', 'mail', 'courriel', 'البريد الالكتروني'],
    fatherName: ['nom du pere', 'pere', 'nom pere', 'father', 'اسم الاب', 'الاب'],
    motherName: ['nom de la mere', 'mere', 'nom mere', 'mother', 'اسم الام', 'الام'],
    parentName: ['nom du tuteur', 'tuteur', 'parent', 'nom parent', 'responsable', 'ولي الامر', 'اسم ولي الامر'],
    parentRelation: ['lien de parente', 'lien', 'relation', 'parente', 'صفة ولي الامر', 'القرابة'],
    parentPhone: ['telephone tuteur', 'tel tuteur', 'tel parent', 'telephone parent', 'gsm parent', 'gsm tuteur', 'tel pere', 'هاتف ولي الامر', 'هاتف الولي', 'هاتف الاب'],
    crecheSection: ['section creche', 'section', 'قسم الحضانة'],
    healthNotes: ['notes de sante', 'sante', 'allergies', 'remarques sante', 'ملاحظات صحية'],
};

const LOOKUP = new Map<string, ImportFieldKey>();
for (const field of IMPORT_FIELDS) {
    LOOKUP.set(foldHeader(field.label), field.key);
    for (const synonym of SYNONYMS[field.key]) if (!LOOKUP.has(foldHeader(synonym))) LOOKUP.set(foldHeader(synonym), field.key);
}

// Template headers are "Nom (النسب)": try the whole header, then the part before a parenthesis.
export const matchHeader = (header: string): ImportFieldKey | null => {
    const whole = LOOKUP.get(foldHeader(header));
    if (whole) return whole;
    const beforeParen = header.split('(')[0];
    return LOOKUP.get(foldHeader(beforeParen)) ?? null;
};

// One field per column: the first column that claims a field keeps it.
export const autoMapping = (headers: string[], allowed: ImportFieldKey[]): (ImportFieldKey | null)[] => {
    const used = new Set<ImportFieldKey>();
    return headers.map((header) => {
        const key = matchHeader(header);
        if (!key || used.has(key) || !allowed.includes(key)) return null;
        used.add(key);
        return key;
    });
};
