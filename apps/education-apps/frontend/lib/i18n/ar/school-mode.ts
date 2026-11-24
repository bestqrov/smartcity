// Private school mode: cycles, levels, inscription file, tuition fees, monthly dues.
export const schoolMode: Record<string, string> = {
    // ---- cycles and levels (lib/schoolLevels.ts)
    Préscolaire: 'التعليم الأولي',
    '1ère année préscolaire': 'السنة الأولى من التعليم الأولي',
    '2ème année préscolaire': 'السنة الثانية من التعليم الأولي',
    '3ème année préscolaire': 'السنة الثالثة من التعليم الأولي',
    '1ère année primaire': 'السنة الأولى ابتدائي',
    '2ème année primaire': 'السنة الثانية ابتدائي',
    '3ème année primaire': 'السنة الثالثة ابتدائي',
    '4ème année primaire': 'السنة الرابعة ابتدائي',
    '5ème année primaire': 'السنة الخامسة ابتدائي',
    '6ème année primaire': 'السنة السادسة ابتدائي',
    '1ère année collège': 'السنة الأولى إعدادي',
    '2ème année collège': 'السنة الثانية إعدادي',
    '3ème année collège': 'السنة الثالثة إعدادي',
    'Tronc commun': 'الجذع المشترك',
    '1ère année Bac': 'السنة الأولى باكالوريا',
    '2ème année Bac': 'السنة الثانية باكالوريا',
    // ---- document checklist
    "Extrait d'acte de naissance": 'نسخة من عقد الازدياد',
    "Photos d'identité": 'صور شمسية',
    'Certificat de départ': 'شهادة المغادرة',
    'Dernier bulletin': 'آخر بيان للنقط',
    'Copie CIN du parent': 'نسخة من البطاقة الوطنية لولي الأمر',
    'Carnet de vaccination': 'دفتر التلقيح',
    // ---- settings card
    "Cycles de l'établissement": 'أسلاك المؤسسة',
    'Cochez les cycles de votre école : l’inscription passe au dossier complet (frais par niveau, code Massar, santé, mensualités).':
        'حدّدوا الأسلاك التعليمية لمؤسستكم: يصبح التسجيل ملفًا متكاملًا (الرسوم حسب المستوى، رمز مسار، المعلومات الصحية، الأقساط الشهرية).',
    'Cycles enregistrés': 'تم حفظ الأسلاك',
    "Échec de l'enregistrement": 'تعذّر الحفظ',
};
