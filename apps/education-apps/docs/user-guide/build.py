#!/usr/bin/env python3
"""Builds the ArwaEduc user guide (guide-ar.html, guide-fr.html) from one bilingual source.

Each chapter is written once with its Arabic and French text side by side, so both guides keep the
same structure and screenshots. Screenshots live in images/ar and images/fr (same file names).
Run:  python3 build.py   then print each HTML to PDF (see README.md).
"""
from html import escape
from pathlib import Path

HERE = Path(__file__).parent


def ui(label):
    """A button / menu label, written exactly as on screen."""
    return f'<span class="ui">{escape(label)}</span>'


# ---------------------------------------------------------------------------------------------
# Content. Each block is (kind, ar, fr). kinds: p, steps (list), tip, warn, h2, img (name, caption),
# phones (list of (name, caption)), pair (two (name, caption)), receipt (name, caption).
# Inline UI labels use {ui:...} markers resolved per language below.
# ---------------------------------------------------------------------------------------------

def U(ar, fr):
    return ('UI', ar, fr)


CHAPTERS = [
    {
        'title': ('إنشاء حساب مؤسستك', 'Créer le compte de votre école'),
        'lead': ('تبدأ كل مؤسسة بإنشاء حسابها من صفحة التسجيل. تستغرق العملية دقيقتين، وتمنحك 15 يوماً من التجربة المجانية دون بطاقة بنكية.',
                 "Tout commence par la création du compte de l'établissement. Cela prend deux minutes et vous donne 15 jours d'essai gratuit, sans carte bancaire."),
        'blocks': [
            ('steps',
             ['افتح صفحة التسجيل من موقع ArwaEduc (زر «إنشاء حساب»)، أو من الرابط الذي أرسله لك المندوب التجاري.',
              'اختر <b>نوع مؤسستك</b>: مدرسة خاصة، مركز دعم مدرسي، تكوين مهني، مركز لغات أو حضانة. تتكيف القوائم مع هذا الاختيار.',
              'اختر <b>المدة</b> (شهري، 6 أشهر، سنوي) ثم <b>الباقة</b>. يظهر الثمن النهائي مباشرة أسفل الخانات.',
              'أدخل <b>رمز المندوب التجاري</b>. الرمز إلزامي؛ إذا لم يكن لديك رمز، انقر على «تواصل معنا عبر واتساب».',
              'أدخل اسمك وبريدك الإلكتروني وكلمة مرور (8 أحرف على الأقل)، ثم انقر على ' + '{ui:إنشاء حسابي}' + '.'],
             ["Ouvrez la page d'inscription depuis le site ArwaEduc (bouton « Créer un compte ») ou depuis le lien envoyé par votre commercial.",
              "Choisissez le <b>type d'établissement</b> : école privée, centre de soutien, formation professionnelle, centre de langues ou crèche. Les menus s'adaptent à ce choix.",
              'Choisissez la <b>durée</b> (mensuel, 6 mois, annuel) puis le <b>pack</b>. Le prix final s’affiche aussitôt sous les choix.',
              "Saisissez le <b>code commercial</b>. Il est obligatoire ; si vous n'en avez pas, cliquez sur « Contactez-nous sur WhatsApp ».",
              'Indiquez votre nom, votre e-mail et un mot de passe (8 caractères minimum), puis cliquez sur {ui:Créer mon compte}.']),
            ('img', 'signup', ('صفحة التسجيل: النوع، المدة، الباقة، الرمز والثمن النهائي', "La page d'inscription : type, durée, pack, code et prix final")),
            ('tip', 'برمز شريك (مندوب شريك) تستفيد تلقائياً من تخفيض يظهر على الثمن النهائي.', "Avec le code d'un partenaire, la réduction s'applique automatiquement et apparaît sur le prix final."),
            ('p', 'بعد التسجيل تدخل مباشرة إلى المنصة، في صفحة الإعدادات، لتكمل معلومات مؤسستك.', "Après l'inscription, vous entrez directement dans la plateforme, sur la page Paramètres, pour compléter les informations de l'école."),
        ],
    },
    {
        'title': ('الدخول، اللغة والإعدادات', 'Connexion, langue et paramètres'),
        'lead': ('تدخل إلى المنصة بالبريد الإلكتروني وكلمة المرور. يمكنك اختيار اللغة العربية أو الفرنسية في أي وقت.',
                 'Vous vous connectez avec votre e-mail et votre mot de passe. Vous pouvez choisir le français ou l’arabe à tout moment.'),
        'blocks': [
            ('h2', 'تسجيل الدخول', 'Se connecter'),
            ('steps',
             ['افتح صفحة الدخول، أدخل بريدك الإلكتروني وكلمة المرور، ثم انقر على ' + '{ui:الدخول إلى المنصة}' + '.',
              'إذا كانت لديك عدة مؤسسات (فروع)، اختر المؤسسة التي تريد العمل عليها.'],
             ['Ouvrez la page de connexion, saisissez votre e-mail et votre mot de passe, puis cliquez sur {ui:Accéder au portail}.',
              'Si vous avez plusieurs établissements, choisissez celui sur lequel vous voulez travailler.']),
            ('img', 'login', ('صفحة الدخول', 'La page de connexion')),
            ('h2', 'اختيار اللغة والمظهر', 'Choisir la langue et le thème'),
            ('p', 'في أعلى كل صفحة يوجد زر <b>FR / ع</b> لتغيير اللغة: بالعربية تنقلب الواجهة كاملة من اليمين إلى اليسار. بجانبه زر الوضع الفاتح/الداكن. يُحفظ اختيارك على هذا الجهاز. على الهاتف، زر اللغة في أسفل القائمة.',
             'En haut de chaque page, le bouton <b>FR / ع</b> change la langue : en arabe, toute l’interface passe de droite à gauche. À côté, le bouton clair/sombre. Votre choix est gardé sur cet appareil. Sur téléphone, le bouton de langue est en bas du menu.'),
            ('h2', 'ملف المؤسسة', "Profil de l'école"),
            ('steps',
             ['من القائمة، افتح ' + '{ui:الإعدادات}' + '.',
              'في تبويب ' + '{ui:ملف المؤسسة}' + '، حمّل <b>شعار</b> مؤسستك: يظهر في القائمة وعلى الوصولات والوثائق.',
              'أكمل اسم المؤسسة، المدير، المدينة، العنوان والهاتف، ثم انقر على ' + '{ui:حفظ الملف}' + '.'],
             ['Dans le menu, ouvrez {ui:Paramètres}.',
              "Dans l'onglet {ui:Profil École}, téléchargez le <b>logo</b> : il apparaît dans le menu, sur les reçus et sur les documents.",
              "Complétez le nom de l'école, le directeur, la ville, l'adresse et le téléphone, puis cliquez sur {ui:Enregistrer le profil}."]),
            ('img', 'settings', ('الإعدادات: ملف المؤسسة', "Paramètres : profil de l'école")),
            ('h2', 'الحسابات: السكرتارية والمدراء', 'Comptes : secrétariat et administrateurs'),
            ('p', 'من ' + '{ui:الطاقم}' + ' ← ' + '{ui:المستخدمون}' + ' أنشئ حساباً لكل شخص يعمل على المنصة (مدير أو سكرتارية) ببريده وكلمة مرور. لكل دور صلاحياته: السكرتارية لا ترى إلا ما تحتاجه يومياً (التسجيلات، الحضور، الوصولات…).',
             'Dans {ui:Personnel} → {ui:Utilisateurs}, créez un compte pour chaque personne qui travaille sur la plateforme (administrateur ou secrétaire), avec son e-mail et un mot de passe. Chaque rôle a ses droits : le secrétariat ne voit que ce qui sert au quotidien (inscriptions, présence, reçus…).'),
            ('img', 'users', ('لائحة المستخدمين', 'La liste des utilisateurs')),
        ],
    },
    {
        'title': ('لوحة القيادة', 'Le tableau de bord'),
        'lead': ('هي أول صفحة بعد الدخول. تعطيك في نظرة واحدة وضعية مؤسستك هذا الشهر.',
                 "C'est la première page après la connexion. Elle résume en un coup d'œil la situation de l'école ce mois-ci."),
        'blocks': [
            ('img', 'dashboard', ('لوحة القيادة', 'Le tableau de bord')),
            ('p', '<b>البطاقات الأربع</b>: التلاميذ النشطون، المحصَّل هذا الشهر (والصافي بعد المصاريف)، المستحقات غير المؤداة، ومصاريف الشهر. تحتها: المداخيل الشهرية، التلاميذ حسب المستوى، التسجيلات حسب الشهر، وكالندريي.',
             "<b>Les quatre cartes</b> : élèves actifs, encaissé ce mois (et net après dépenses), impayés, dépenses du mois. En dessous : encaissements mensuels, élèves par niveau, inscriptions par mois et un calendrier."),
            ('p', '<b>مهام للإنجاز</b>: تنبيهات قابلة للنقر، مثل تذكير الآباء بالمستحقات أو تلاميذ بدون تسجيل. <b>وصول سريع</b>: أزرار نحو الصفحات الأكثر استعمالاً.',
             '<b>À faire</b> : des alertes cliquables, par exemple relancer les impayés ou des élèves sans inscription. <b>Accès rapide</b> : des raccourcis vers les pages les plus utilisées.'),
            ('tip', 'زر ' + '{ui:تسجيل جديد}' + ' في أعلى الصفحة يفتح استمارة التسجيل مباشرة.', 'Le bouton {ui:Nouvelle Inscription} en haut de la page ouvre directement le formulaire d’inscription.'),
        ],
    },
    {
        'title': ('تحضير السنة: الأساتذة، الأسعار والمجموعات', "Préparer l'année : professeurs, prix et groupes"),
        'lead': ('قبل تسجيل التلاميذ، أدخل أساتذتك وأسعارك، ثم أنشئ المجموعات مع استعمال الزمن. الحضور والنقط والواجبات تعتمد كلها على المجموعات.',
                 'Avant d’inscrire les élèves, saisissez vos professeurs et vos prix, puis créez les groupes avec leur emploi du temps. Présence, notes et devoirs reposent tous sur les groupes.'),
        'blocks': [
            ('h2', '1. الأساتذة', '1. Les professeurs'),
            ('steps',
             ['افتح ' + '{ui:الأساتذة}' + ' ثم ' + '{ui:أستاذ(ة) جديد(ة)}' + '.',
              'أدخل الاسم والهاتف والمواد المدرَّسة والمستويات.',
              'اختر <b>نوع الأداء</b>: بالساعة، أجرة ثابتة، أو نسبة عن كل تسجيل. يُستعمل هذا لاحقاً في حساب الأجور.'],
             ['Ouvrez {ui:Professeur} puis {ui:Nouveau Professeur}.',
              'Saisissez le nom, le téléphone, les matières enseignées et les niveaux.',
              'Choisissez le <b>type de paiement</b> : à l’heure, salaire fixe ou pourcentage par inscription. Il sert ensuite au calcul des salaires.']),
            ('img', 'teachers', ('لائحة الأساتذة', 'La liste des professeurs')),
            ('h2', '2. الأسعار', '2. Les prix'),
            ('p', 'في ' + '{ui:المالية}' + ' ← ' + '{ui:الأسعار}' + ' حدد ثمن كل مادة حسب المستوى. تستعمل استمارة التسجيل هذه الأسعار لحساب المبلغ تلقائياً.',
             'Dans {ui:Finance} → {ui:Prix}, fixez le prix de chaque matière par niveau. Le formulaire d’inscription utilise ces prix pour calculer le montant automatiquement.'),
            ('img', 'prix', ('الأسعار حسب المستوى والمادة', 'Les prix par niveau et matière')),
            ('h2', '3. المجموعات واستعمال الزمن', '3. Les groupes et l’emploi du temps'),
            ('steps',
             ['افتح ' + '{ui:المجموعات}' + ' ثم ' + '{ui:مجموعة جديدة}' + '.',
              'أدخل اسم المجموعة (مثال: Maths 3AC)، المستوى، المادة، الأستاذ والقاعة.',
              'في <b>استعمال الزمن</b>، أضف الحصص: اليوم وساعة البداية والنهاية (بين 08:00 و23:30). يمكن إضافة عدة حصص في اليوم.',
              'يمكنك إضافة رابط مجموعة واتساب ليفتحه الجميع من لائحة المجموعات.'],
             ['Ouvrez {ui:Groups} puis {ui:Nouveau Groupe}.',
              'Saisissez le nom du groupe (ex. Maths 3AC), le niveau, la matière, le professeur et la salle.',
              'Dans <b>Emploi du Temps</b>, ajoutez les séances : jour, heure de début et de fin (entre 08:00 et 23:30). Plusieurs séances par jour sont possibles.',
              'Vous pouvez ajouter le lien du groupe WhatsApp, accessible depuis la liste des groupes.']),
            ('pair', ('groups', ('بطاقات المجموعات', 'Les cartes des groupes')), ('group-edit', ('تعديل مجموعة: استعمال الزمن', 'Modifier un groupe : emploi du temps'))),
            ('tip', 'الحصص المسجلة في استعمال الزمن هي التي تظهر في صفحة الحضور وعند الآباء («الحصة القادمة»).', 'Les séances de l’emploi du temps sont celles qui apparaissent dans la présence et chez les parents (« prochaine séance »).'),
        ],
    },
    {
        'title': ('تسجيل التلاميذ', 'Inscrire les élèves'),
        'lead': ('طريقتان: تسجيل تلميذ واحد عبر الاستمارة، أو استيراد لائحة كاملة من Excel في دقيقة.',
                 'Deux façons : inscrire un élève avec le formulaire, ou importer toute une liste depuis Excel en une minute.'),
        'blocks': [
            ('h2', 'أ. تسجيل تلميذ واحد', 'A. Inscrire un élève'),
            ('steps',
             ['افتح ' + '{ui:الدعم المدرسي}' + ' ← ' + '{ui:التسجيلات}' + ' (أو زر ' + '{ui:تسجيل جديد}' + ').',
              'املأ المعلومات الشخصية للتلميذ ومعلومات ولي الأمر (الاسم، صلة القرابة، الهاتف).',
              'اختر المستوى الدراسي ثم المواد: يُحسب المجموع تلقائياً في «الملخص» (واجبات التسجيل + المواد).',
              'انقر على ' + '{ui:حفظ التسجيل}' + '. يمكنك طباعة الوصل مباشرة.'],
             ['Ouvrez {ui:Soutien Scolaire} → {ui:Inscriptions} (ou le bouton {ui:Nouvelle Inscription}).',
              "Remplissez les informations de l'élève et celles du parent ou tuteur (nom, lien de parenté, téléphone).",
              'Choisissez le niveau puis les matières : le total se calcule tout seul dans le « Récapitulatif » (frais d’inscription + matières).',
              'Cliquez sur {ui:Enregistrer l\'inscription}. Vous pouvez imprimer le reçu tout de suite.']),
            ('img', 'inscription', ('استمارة التسجيل والملخص', 'Le formulaire d’inscription et le récapitulatif')),
            ('h2', 'ب. استيراد لائحة من Excel', 'B. Importer une liste Excel'),
            ('steps',
             ['افتح ' + '{ui:الاستيراد من Excel}' + '. يمكنك تحميل النموذج، أو استعمال ملفك الحالي (سطر لكل تلميذ، والعناوين في السطر الأول).',
              'اختر الملف (.xlsx أو .xls أو .csv). تتعرف المنصة على الأعمدة تلقائياً؛ تحقق منها وصحح ما يلزم.',
              'انقر على ' + '{ui:التحقق من الأسطر}' + ': كل سطر يظهر «صالح» أو «مكرر» أو «خطأ» مع السبب.',
              'إذا كانت مجموعات الملف غير موجودة، فعّل ' + '{ui:إنشاء هذه المجموعات تلقائياً}' + '، ثم انقر على ' + '{ui:استيراد}' + '.'],
             ['Ouvrez {ui:Import Excel}. Téléchargez le modèle, ou utilisez votre fichier actuel (une ligne par élève, les en-têtes sur la première ligne).',
              'Choisissez le fichier (.xlsx, .xls ou .csv). La plateforme reconnaît les colonnes ; vérifiez-les et corrigez si besoin.',
              'Cliquez sur {ui:Vérifier les lignes} : chaque ligne est « Valide », « Doublon » ou « Erreur », avec la raison.',
              'Si des groupes du fichier n’existent pas, cochez {ui:Créer ces groupes automatiquement}, puis cliquez sur {ui:Importer}.']),
            ('pair', ('import-2', ('ربط الأعمدة', 'Association des colonnes')), ('import-3', ('التحقق من الأسطر', 'Vérification des lignes'))),
            ('tip', 'يُنشئ الاستيراد أيضاً ملفات أولياء الأمور: الإخوة الذين لهم نفس هاتف ولي الأمر يُربطون بنفس الولي.', 'L’import crée aussi les fiches parents : les frères et sœurs qui ont le même téléphone de tuteur sont rattachés au même parent.'),
            ('h2', 'ج. لائحة التلاميذ وملف التلميذ', "C. La liste et la fiche de l'élève"),
            ('p', 'في ' + '{ui:التلاميذ}' + ' تجد كل التلاميذ مع البحث والتصفية حسب المستوى. انقر على تلميذ لفتح ملفه: المعلومات، التسجيلات، المالية (الأداءات والرصيد) والحضور، بالإضافة إلى اشتراك النقل إن وُجد.',
             'Dans {ui:Students}, vous retrouvez tous les élèves, avec la recherche et le filtre par niveau. Cliquez sur un élève pour ouvrir sa fiche : informations, inscriptions, finances (paiements et solde) et présences, plus son abonnement transport s’il en a un.'),
            ('img', 'students', ('لائحة التلاميذ', 'La liste des élèves')),
            ('pair', ('student-finances', ('ملف التلميذ: المالية', 'Fiche élève : finances')), ('student-presences', ('ملف التلميذ: الحضور', 'Fiche élève : présences'))),
            ('p', 'من ملف التلميذ يمكنك أيضاً إنشاء <b>رابط الملف الشخصي</b> للتلميذ و<b>رمز QR للحضور</b> (بطاقة يُمسح عليها عند الدخول).',
             'Depuis la fiche, vous pouvez aussi créer le <b>lien de profil</b> de l’élève et son <b>QR de présence</b> (la carte scannée à l’entrée).'),
        ],
    },
    {
        'title': ('الحضور', 'La présence'),
        'lead': ('يُسجَّل الحضور على حصص استعمال الزمن، يدوياً أو بمسح رمز QR. ويُخبَر الآباء تلقائياً بالغيابات.',
                 "La présence se fait sur les séances de l'emploi du temps, à la main ou en scannant un QR. Les parents sont prévenus des absences."),
        'blocks': [
            ('h2', 'حضور الأسبوع', 'La présence de la semaine'),
            ('steps',
             ['افتح ' + '{ui:الحضور}' + ' ← ' + '{ui:حضور الأسبوع}' + ' واختر المجموعة.',
              'يظهر أسبوع المجموعة مع حصصها. اللون الأخضر: الحضور مسجل؛ البرتقالي: تلاميذ لم يُسجَّلوا بعد.',
              'انقر على حصة لتسجيل الحضور: <b>ح</b> حاضر، <b>م</b> متأخر، <b>غ</b> غائب، <b>ب</b> غياب مبرر (مع السبب). زر ' + '{ui:الباقون حاضرون}' + ' يسجل الجميع حاضرين دفعة واحدة.',
              'انقر على ' + '{ui:حفظ}' + '.'],
             ['Ouvrez {ui:Présence} → {ui:Présence de la semaine} et choisissez le groupe.',
              "La semaine du groupe s'affiche avec ses séances. Vert : présence saisie ; orange : des élèves pas encore saisis.",
              'Cliquez sur une séance pour faire l’appel : <b>P</b> présent, <b>R</b> en retard, <b>A</b> absent, <b>J</b> absence justifiée (avec le motif). Le bouton {ui:Les autres sont présents} marque tout le monde d’un coup.',
              'Cliquez sur {ui:Enregistrer}.']),
            ('img', 'presence-week', ('حضور الأسبوع لمجموعة', 'La semaine d’un groupe')),
            ('img', 'presence-call', ('تسجيل الحضور لحصة', "L'appel d'une séance")),
            ('p', 'تبويب ' + '{ui:ملخص حسب التلميذ}' + ' يعرض حضور كل تلميذ خلال الأسبوع ونسبة حضوره. زر ' + '{ui:طباعة}' + ' يطبع ورقة الأسبوع.',
             "L'onglet {ui:Récap par élève} montre la présence de chaque élève sur la semaine et son taux. Le bouton {ui:Imprimer} imprime la feuille de la semaine."),
            ('img', 'presence-recap', ('الملخص حسب التلميذ', 'Le récapitulatif par élève')),
            ('h2', 'الحضور بمسح رمز QR', 'La présence par QR'),
            ('p', 'افتح ' + '{ui:مسح رمز QR}' + '، اختر المجموعة، ثم وجّه الكاميرا نحو بطاقة التلميذ. يُسجَّل الحضور (أو التأخر) فوراً على الحصة الجارية.',
             'Ouvrez {ui:Scanner QR}, choisissez le groupe et présentez la carte de l’élève à la caméra. La présence (ou le retard) est enregistrée aussitôt sur la séance en cours.'),
        ],
    },
    {
        'title': ('المالية: الأداءات، الوصولات والأجور', 'Finances : paiements, reçus et salaires'),
        'lead': ('كل الأموال الداخلة والخارجة في مكان واحد، مع وصولات قابلة للطباعة على الطابعة الحرارية.',
                 "Tout l'argent qui entre et qui sort au même endroit, avec des reçus imprimables sur imprimante thermique."),
        'blocks': [
            ('h2', 'الوصولات', 'Les reçus'),
            ('p', 'في ' + '{ui:المالية}' + ' ← ' + '{ui:الوصولات}' + ' يظهر وصل لكل تسجيل. انقر على أيقونة الطباعة لطباعته (عرض 80 ملم). يمكنك أيضاً إنشاء وصل حر (خدمات، مواد…).',
             'Dans {ui:Finance} → {ui:Reçus}, chaque inscription a son reçu. Cliquez sur l’icône d’impression pour l’imprimer (largeur 80 mm). Vous pouvez aussi créer un reçu libre (services, articles…).'),
            ('img', 'recus', ('لائحة الوصولات', 'La liste des reçus')),
            ('receipt', 'receipt-print', ('وصل مطبوع: يُطبع بلغة الواجهة', "Un reçu imprimé : il suit la langue de l'interface")),
            ('h2', 'المعاملات (الصندوق)', 'Les transactions (caisse)'),
            ('p', 'في ' + '{ui:المعاملات}' + ' تسجل المداخيل والمصاريف (الكراء، الفواتير، اللوازم…) وترى الرصيد الحالي. أداءات التلاميذ تُضاف تلقائياً.',
             'Dans {ui:Transactions}, enregistrez les entrées et les dépenses (loyer, factures, fournitures…) et suivez le solde. Les paiements des élèves s’y ajoutent automatiquement.'),
            ('img', 'transactions', ('المعاملات', 'Les transactions')),
            ('h2', 'أجور الطاقم', 'Les salaires du personnel'),
            ('steps',
             ['افتح ' + '{ui:الأداءات}' + ' (الأجور). تظهر لائحة الأساتذة والسكرتارية مع نوع أجرتهم.',
              'اختر الشهر ثم انقر على ' + '{ui:احتساب الأجور}' + ': تُحسب أجرة كل عضو حسب نوعها.',
              'عند الأداء، انقر على ' + '{ui:أداء أجرة}' + ': يُسجَّل الأداء ويُضاف إلى المصاريف.'],
             ['Ouvrez {ui:Paiements} (salaires). Les professeurs et le secrétariat apparaissent avec leur type de salaire.',
              'Choisissez le mois et cliquez sur {ui:Générer Salaires} : le salaire de chacun est calculé selon son type.',
              'Au moment du paiement, cliquez sur {ui:Effectuer un salaire} : le paiement est enregistré et ajouté aux dépenses.']),
            ('img', 'salaires', ('حساب الأجور الشهري', 'Le calcul mensuel des salaires')),
        ],
    },
    {
        'title': ('النقط، الواجبات والأنشطة', 'Notes, devoirs et activités'),
        'lead': ('ما يُدخله الأساتذة والإدارة هنا يظهر مباشرة في فضاء الآباء.',
                 'Ce que les professeurs et l’administration saisissent ici apparaît directement dans l’espace parents.'),
        'blocks': [
            ('h2', 'النقط وبيان النقط', 'Notes et bulletins'),
            ('steps',
             ['في ' + '{ui:الإعدادات}' + ' اختر فترات التقييم (أسدسات أو فصول).',
              'افتح ' + '{ui:النقط}' + '، اختر المجموعة، ثم ' + '{ui:فرض جديد}' + ': العنوان، الفترة، التاريخ، سلم التنقيط والمعامل.',
              'أدخل نقطة كل تلميذ (أو «غ» للغائب). يُحفظ كل إدخال تلقائياً.',
              'انقر على ' + '{ui:نشر}' + ' ليرى الآباء النقط. تبويب ' + '{ui:بيان النقط}' + ' يحسب المعدلات والرتبة ويطبع البيانات.'],
             ['Dans {ui:Paramètres}, choisissez les périodes de notation (semestres ou trimestres).',
              'Ouvrez {ui:Notes}, choisissez le groupe puis {ui:Nouvelle évaluation} : titre, période, date, barème et coefficient.',
              'Saisissez la note de chaque élève (ou « Abs » pour un absent). Chaque saisie est enregistrée toute seule.',
              'Cliquez sur {ui:Publier} pour que les parents voient les notes. L’onglet {ui:Bulletin} calcule les moyennes et le rang, et imprime les bulletins.']),
            ('pair', ('grades-entry', ('إدخال النقط', 'La saisie des notes')), ('bulletin', ('بيان النقط', 'Le bulletin'))),
            ('h2', 'الواجبات المنزلية', 'Les devoirs'),
            ('p', 'في ' + '{ui:الواجبات المنزلية}' + ' اختر المجموعة وأضف الواجب مع تاريخ التسليم. يظهر للآباء في «واجبات للإنجاز».',
             'Dans {ui:Devoirs}, choisissez le groupe et ajoutez le devoir avec sa date. Il apparaît chez les parents dans « Devoirs à faire ».'),
            ('img', 'homework', ('الواجبات المنزلية لمجموعة', "Les devoirs d'un groupe")),
            ('h2', 'الأنشطة والخرجات', 'Activités et sorties'),
            ('steps',
             ['في ' + '{ui:الأنشطة}' + ' انقر على ' + '{ui:نشاط جديد}' + ': العنوان، التاريخ، المكان، الثمن، وصورة الغلاف.',
              'فعّل «طلب موافقة أولياء الأمور» وحدد آخر أجل للرد إذا كانت خرجة.',
              'اختر المعنيين (جميع التلاميذ أو بعض المجموعات) ثم انقر على ' + '{ui:نشر}' + ': يتوصل الآباء بإشعار.',
              'افتح النشاط لتتبع الردود، تسجيل من أدّى، تذكير من لم يردّوا، وتصدير اللائحة إلى Excel.'],
             ['Dans {ui:Activités}, cliquez sur {ui:Nouvelle activité} : titre, date, lieu, prix et image de couverture.',
              'Activez « Demander l’accord des parents » et fixez une date limite s’il s’agit d’une sortie.',
              'Choisissez les élèves concernés (tous ou certains groupes) puis cliquez sur {ui:Publier} : les parents sont notifiés.',
              'Ouvrez l’activité pour suivre les réponses, cocher qui a payé, relancer ceux qui n’ont pas répondu et exporter la liste vers Excel.']),
            ('img', 'activity-detail', ('ردود الآباء على خرجة', 'Les réponses des parents à une sortie')),
        ],
    },
    {
        'title': ('أولياء الأمور وفضاؤهم', 'Les parents et leur espace'),
        'lead': ('لكل ولي أمر فضاء على هاتفه، بدون كلمة مرور: يكفي رابط شخصي أو رمز QR.',
                 'Chaque parent a son espace sur téléphone, sans mot de passe : un lien personnel ou un QR suffit.'),
        'blocks': [
            ('h2', 'إرسال الروابط', 'Envoyer les liens'),
            ('steps',
             ['افتح ' + '{ui:أولياء الأمور}' + ' ← ' + '{ui:ولوج أولياء الأمور}' + '.',
              'انقر على ' + '{ui:تحديد أولياء الأمور بدون رابط}' + '.',
              'أرسل الروابط عبر واتساب (زر لكل ولي)، أو انقر على ' + '{ui:طباعة بطاقات QR}' + ' لتوزيعها على الآباء.'],
             ['Ouvrez {ui:Parents} → {ui:Accès parents}.',
              'Cliquez sur {ui:Sélectionner les parents sans lien}.',
              'Envoyez les liens par WhatsApp (un bouton par parent), ou cliquez sur {ui:Imprimer les cartes QR} pour les distribuer.']),
            ('img', 'parents-access', ('ولوج أولياء الأمور: الروابط وبطاقات QR', 'Accès parents : liens et cartes QR')),
            ('warn', 'لأسباب أمنية، لا يُعرض الرابط إلا مرة واحدة. إذا ضاع، أنشئ رابطاً جديداً: الرابط القديم يتوقف عن العمل.', 'Par sécurité, le lien n’est affiché qu’une fois. S’il est perdu, créez-en un nouveau : l’ancien ne fonctionne plus.'),
            ('h2', 'ما يراه الآباء', 'Ce que voient les parents'),
            ('p', 'الرئيسية (حضور اليوم، الحصة القادمة، المبلغ المتبقي، النشاط القادم، الواجبات وآخر النقط)، الحضور، الأداءات، الدراسة (النقط والواجبات) والمؤسسة (الإعلانات، العطل، الأنشطة). يتنقل الولي بين أبنائه من الأعلى، ويختار العربية أو الفرنسية.',
             "Accueil (présence du jour, prochaine séance, reste à payer, prochaine activité, devoirs et dernières notes), présence, paiements, scolarité (notes et devoirs) et école (annonces, vacances, activités). Le parent passe d'un enfant à l'autre en haut et choisit le français ou l'arabe."),
            ('phones', [('parent-home', ('الرئيسية', 'Accueil')), ('parent-attendance', ('الحضور', 'Présence')), ('parent-payments', ('الأداءات', 'Paiements'))]),
        ],
    },
    {
        'title': ('فضاء الأستاذ', "L'espace professeur"),
        'lead': ('يُدخل الأستاذ النقط والواجبات من هاتفه، عبر رابط شخصي بدون كلمة مرور.',
                 'Le professeur saisit les notes et les devoirs depuis son téléphone, avec un lien personnel sans mot de passe.'),
        'blocks': [
            ('steps',
             ['في ' + '{ui:الأساتذة}' + '، انقر على ' + '{ui:رابط الأستاذ}' + ' للأستاذ المعني، ثم أرسله له عبر واتساب.',
              'يفتح الأستاذ الرابط ويرى مجموعاته فقط.',
              'يختار مجموعة: تبويب «الفروض» لإدخال النقط، وتبويب «الواجبات المنزلية» لإضافة الواجبات.'],
             ['Dans {ui:Professeur}, cliquez sur {ui:Lien enseignant} pour le professeur concerné, puis envoyez-le-lui par WhatsApp.',
              'Le professeur ouvre le lien et ne voit que ses groupes.',
              'Il choisit un groupe : onglet « Évaluations » pour les notes, onglet « Devoirs » pour les devoirs.']),
            ('phones', [('teacher-home', ('مجموعات الأستاذ', 'Les groupes du professeur')), ('teacher-group', ('إدخال النقط', 'La saisie des notes'))]),
        ],
    },
    {
        'title': ('التواصل: الإعلانات، العطل وواتساب', 'Communication : annonces, vacances et WhatsApp'),
        'lead': ('', ''),
        'blocks': [
            ('h2', 'الإعلانات', 'Les annonces'),
            ('p', 'في ' + '{ui:التواصل}' + ' ← ' + '{ui:الإعلانات}' + ' اكتب العنوان والمحتوى ثم أضف الإعلان. يظهر فوراً في فضاء الآباء والتلاميذ.',
             'Dans {ui:Communication} → {ui:Annonces}, écrivez le titre et le contenu puis ajoutez l’annonce. Elle apparaît aussitôt chez les parents et les élèves.'),
            ('img', 'annonces', ('الإعلانات', 'Les annonces')),
            ('h2', 'العطل', 'Les vacances'),
            ('p', 'في ' + '{ui:العطل}' + ' أضف فترات الإغلاق. لا تُحتسب أيام العطل في الحضور، وتظهر للآباء.',
             'Dans {ui:Vacances}, ajoutez les périodes de fermeture. Ces jours ne comptent pas dans la présence et sont affichés aux parents.'),
            ('h2', 'واتساب التلقائي', 'WhatsApp automatique'),
            ('p', 'في ' + '{ui:الإعدادات}' + '، اربط رقم واتساب مؤسستك بمسح رمز QR. بعدها تُرسل الغيابات والنقط والإعلانات والأنشطة تلقائياً إلى الآباء من رقمكم. يمكنك اختيار ما يُرسل.',
             'Dans {ui:Paramètres}, connectez le numéro WhatsApp de l’école en scannant un QR. Ensuite, absences, notes, annonces et activités partent automatiquement vers les parents depuis votre numéro. Vous choisissez ce qui est envoyé.'),
            ('img', 'settings-more', ('واتساب التلقائي وفترات التقييم في الإعدادات', 'WhatsApp automatique et périodes de notation dans les paramètres')),
        ],
    },
    {
        'title': ('النقل المدرسي', 'Le transport scolaire'),
        'lead': ('الخطوط والمحطات، المركبات والسائقون، الاشتراكات والأداءات الشهرية.',
                 'Lignes et arrêts, véhicules et chauffeurs, abonnements et paiements mensuels.'),
        'blocks': [
            ('steps',
             ['في تبويب ' + '{ui:المركبات والسائقون}' + ' أضف المركبات (رقم التسجيل، عدد المقاعد) والسائقين.',
              'في ' + '{ui:الخطوط والمحطات}' + ' اختر طريقة التسعير (حسب الخط، حسب المحطة، أو ثمن موحد)، ثم أنشئ الخطوط ومحطاتها بمواعيد الصباح والمساء.',
              'في ' + '{ui:الاشتراكات}' + ' أشرك التلاميذ في خط ومحطة، وسجل الأداء الشهري بزر ' + '{ui:تحصيل}' + '.',
              'تبويب ' + '{ui:المستحقات غير المؤدّاة}' + ' يعرض من لم يؤدِّ هذا الشهر.'],
             ['Dans l’onglet {ui:Véhicules & chauffeurs}, ajoutez les véhicules (immatriculation, places) et les chauffeurs.',
              'Dans {ui:Lignes & arrêts}, choisissez le mode de prix (par ligne, par arrêt ou prix unique), puis créez les lignes et leurs arrêts avec les horaires du matin et du soir.',
              'Dans {ui:Abonnements}, abonnez les élèves à une ligne et un arrêt, et encaissez le mois avec {ui:Encaisser}.',
              'L’onglet {ui:Impayés} montre qui n’a pas payé ce mois-ci.']),
            ('pair', ('transport-lignes', ('الخطوط والمحطات', 'Lignes et arrêts')), ('transport-abo', ('الاشتراكات', 'Abonnements'))),
        ],
    },
    {
        'title': ('الوثائق', 'Les documents'),
        'lead': ('', ''),
        'blocks': [
            ('p', 'في ' + '{ui:الوثائق}' + ' اختر تلميذاً لإنشاء <b>بطاقة المعلومات الفردية</b> أو <b>شهادة التسجيل</b>، بشعار مؤسستك ومعلومات التلميذ، ثم اطبعها. تُطبع الوثيقة بلغة الواجهة.',
             'Dans {ui:Documents}, choisissez un élève pour générer sa <b>fiche de renseignements</b> ou son <b>attestation d’inscription</b>, avec votre logo et ses informations, puis imprimez-la. Le document suit la langue de l’interface.'),
            ('img', 'documents-fiche', ('بطاقة المعلومات الفردية', 'La fiche de renseignements')),
        ],
    },
    {
        'title': ('فضاء السكرتارية', "L'espace secrétariat"),
        'lead': ('تدخل السكرتارية بحسابها الخاص، وترى لوحة قيادة مبسطة وما تحتاجه يومياً فقط.',
                 'Le secrétariat se connecte avec son propre compte et voit un tableau de bord simplifié, avec seulement ce qui sert au quotidien.'),
        'blocks': [
            ('img', 'secretary', ('لوحة قيادة السكرتارية', 'Le tableau de bord du secrétariat')),
            ('p', 'تسجيل التلاميذ والاستيراد، الحضور ومسح QR، النقط والواجبات والأنشطة، ولوج أولياء الأمور، والوصولات. لا تصل السكرتارية إلى الأجور ولا إلى إعدادات المؤسسة.',
             'Inscriptions et import, présence et scan QR, notes, devoirs et activités, accès parents et reçus. Le secrétariat n’a accès ni aux salaires ni aux paramètres de l’école.'),
        ],
    },
    {
        'title': ('عدة مؤسسات وتغيير الباقة', 'Plusieurs établissements et changement de pack'),
        'lead': ('', ''),
        'blocks': [
            ('p', 'يمكن للمالك تسيير عدة مؤسسات (فروع) بحساب واحد. في ' + '{ui:جميع المؤسسات}' + ' يرى ملخص كل مؤسسة (التلاميذ، الحاضرون اليوم، الرصيد المستحق)، ويضيف مؤسسة جديدة حسب حد باقته، وينتقل بينها بنقرة.',
             'Le propriétaire peut gérer plusieurs établissements avec un seul compte. Dans {ui:Tous les établissements}, il voit le résumé de chacun (élèves, présents aujourd’hui, solde dû), ajoute un établissement selon la limite de son pack et passe de l’un à l’autre en un clic.'),
            ('img', 'branches', ('جميع المؤسسات', 'Tous les établissements')),
            ('tip', 'إذا بلغت حد باقتك (عدد التلاميذ أو المؤسسات)، تقترح المنصة الباقة المناسبة ويمكنك الانتقال إليها فوراً.', 'Si vous atteignez la limite de votre pack (élèves ou établissements), la plateforme propose le pack adapté et vous pouvez y passer tout de suite.'),
        ],
    },
    {
        'title': ('على الهاتف', 'Sur téléphone'),
        'lead': ('المنصة كاملة تعمل على الهاتف، بدون تطبيق يُحمَّل: افتح الموقع من المتصفح.',
                 'Toute la plateforme fonctionne sur téléphone, sans application à installer : ouvrez le site dans le navigateur.'),
        'blocks': [
            ('phones', [('phone-dashboard', ('لوحة القيادة', 'Tableau de bord')), ('phone-menu', ('القائمة وزر اللغة', 'Le menu et la langue'))]),
            ('tip', 'على الهاتف، القائمة خلف زر ☰ في الأعلى، وزر اللغة FR / ع في أسفلها.', 'Sur téléphone, le menu est derrière le bouton ☰ en haut, et le bouton de langue FR / ع en bas du menu.'),
        ],
    },
]

TEXT = {
    'ar': {
        'title': 'دليل الاستعمال', 'subtitle': 'من تسجيل المؤسسة إلى آخر خدمة، خطوة بخطوة',
        'intro': 'هذا الدليل موجه لمديري المؤسسات والسكرتارية. يشرح كيف تُسيِّر مؤسستك على ArwaEduc: التسجيل، التلاميذ، الحضور، المالية، النقط، التواصل مع الآباء، النقل والوثائق.',
        'meta': 'نسخة نونبر 2026 · الصور مأخوذة من مؤسسة تجريبية بأسماء وهمية',
        'toc': 'المحتوى', 'roles_title': 'من يفعل ماذا؟',
        'roles': [('المالك', 'كل شيء، وعدة مؤسسات'), ('المدير', 'تسيير المؤسسة كاملة'), ('السكرتارية', 'العمل اليومي'), ('الأستاذ', 'النقط والواجبات من هاتفه'), ('ولي الأمر', 'متابعة أبنائه من هاتفه')],
        'back_title': 'تحتاج مساعدة؟', 'back_text': 'فريق ArwaEduc رهن إشارتك لتكوين فريقك ومرافقتك في بداية الاستعمال.',
    },
    'fr': {
        'title': "Guide d'utilisation", 'subtitle': "De l'inscription de l'école au dernier service, étape par étape",
        'intro': "Ce guide s'adresse aux directeurs et au secrétariat. Il explique comment gérer votre établissement avec ArwaEduc : inscription, élèves, présence, finances, notes, communication avec les parents, transport et documents.",
        'meta': "Version de novembre 2026 · Captures prises sur une école de démonstration (noms fictifs)",
        'toc': 'Sommaire', 'roles_title': 'Qui fait quoi ?',
        'roles': [('Propriétaire', 'Tout, et plusieurs établissements'), ('Administrateur', "Toute la gestion de l'école"), ('Secrétariat', 'Le travail quotidien'), ('Professeur', 'Notes et devoirs depuis son téléphone'), ('Parent', 'Suit ses enfants sur son téléphone')],
        'back_title': "Besoin d'aide ?", 'back_text': "L'équipe ArwaEduc est à votre disposition pour former votre équipe et vous accompagner au démarrage.",
    },
}

LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>'


def resolve(text, lang):
    """Turns {ui:Label} markers into styled spans (the label is already in the guide's language)."""
    out, rest = '', text
    while '{ui:' in rest:
        before, _, after = rest.partition('{ui:')
        label, _, rest = after.partition('}')
        out += before + ui(label)
    return out + rest


def fig(name, caption, lang, cls=''):
    return f'<figure class="{cls}"><img src="images/{lang}/{name}.jpg" alt="{escape(caption)}"><figcaption>{escape(caption)}</figcaption></figure>'


def build(lang):
    i = 0 if lang == 'ar' else 1
    t = TEXT[lang]
    parts = [f'''<!doctype html>
<html lang="{lang}" dir="{'rtl' if lang == 'ar' else 'ltr'}">
<head>
<meta charset="utf-8">
<title>ArwaEduc — {escape(t['title'])}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
</head>
<body>
<section class="cover">
  <div class="logo">{LOGO}</div>
  <h1>ArwaEduc</h1>
  <h2>{escape(t['title'])} — {escape(t['subtitle'])}</h2>
  <p>{escape(t['intro'])}</p>
  <div class="meta">{escape(t['meta'])}</div>
</section>
<section class="toc">
  <h1>{t['toc']}</h1>
  <ol>{''.join(f'<li>{escape(c["title"][i])}</li>' for c in CHAPTERS)}</ol>
  <h2>{t['roles_title']}</h2>
  <div class="roles">{''.join(f'<div class="role"><b>{escape(a)}</b>{escape(b)}</div>' for a, b in t['roles'])}</div>
</section>
''']
    for n, ch in enumerate(CHAPTERS, 1):
        parts.append(f'<section class="chapter"><h1><span class="n">{n}</span>{escape(ch["title"][i])}</h1>')
        if ch['lead'][i]:
            parts.append(f'<p class="lead">{resolve(ch["lead"][i], lang)}</p>')
        for block in ch['blocks']:
            kind = block[0]
            if kind in ('p', 'tip', 'warn'):
                body = resolve(block[1 + i], lang)
                parts.append(f'<p>{body}</p>' if kind == 'p' else f'<div class="{kind}">{body}</div>')
            elif kind == 'h2':
                parts.append(f'<h2>{escape(block[1 + i])}</h2>')
            elif kind == 'steps':
                parts.append('<ol class="steps">' + ''.join(f'<li>{resolve(s, lang)}</li>' for s in block[1 + i]) + '</ol>')
            elif kind == 'img':
                parts.append(fig(block[1], block[2][i], lang))
            elif kind == 'receipt':
                parts.append(fig(block[1], block[2][i], lang, 'receipt'))
            elif kind == 'pair':
                parts.append('<div class="pair">' + ''.join(fig(name, cap[i], lang) for name, cap in block[1:]) + '</div>')
            elif kind == 'phones':
                parts.append('<div class="phones">' + ''.join(fig(name, cap[i], lang) for name, cap in block[1]) + '</div>')
        parts.append('</section>')
    parts.append(f'''<section class="back">
  <h1>{escape(t['back_title'])}</h1>
  <p>{escape(t['back_text'])}</p>
  <div class="contact"><span class="ltr">education.morosmartcitys.com</span> · WhatsApp <span class="ltr">+212 608 18 38 86</span></div>
</section>
</body>
</html>''')
    (HERE / f'guide-{lang}.html').write_text('\n'.join(parts), encoding='utf-8')


if __name__ == '__main__':
    for lang in ('ar', 'fr'):
        build(lang)
    print('built guide-ar.html and guide-fr.html')
