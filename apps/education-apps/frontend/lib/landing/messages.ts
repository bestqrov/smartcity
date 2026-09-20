export type Lang = 'fr' | 'ar';

const fr = {nav_pricing:"Tarifs",nav_login:"Connexion",badge:"15 jours d'essai gratuit",
h1:"Gérez votre école simplement, de l'inscription au transport.",
lead:"Élèves, paiements, présences par QR, transport scolaire et portail parents — dans une seule plateforme, en arabe et en français.",
cta1:"Essayer 15 jours gratuits",cta2:"Voir les fonctionnalités",nocard:"Sans carte bancaire · Sans engagement",


f_title:"Tout ce dont votre école a besoin",f_sub:"Des outils pensés pour les écoles privées, centres de soutien, de formation et de langues, et crèches au Maroc.",
f1t:"Portail parents",f1d:"Présence, solde et transport de leur enfant, via un simple lien.",
f2t:"Présence par QR",f2d:"Scannez, c'est noté. Les absences sont visibles tout de suite.",
f3t:"Transport scolaire",f3d:"Lignes, arrêts, horaires, chauffeurs et abonnements mensuels.",
f4t:"Paiements & finances",f4d:"Inscriptions, mensualités, reçus et suivi des impayés.",
f5t:"Multi-établissements",f5d:"Plusieurs sites, une seule vue d'ensemble pour le propriétaire.",
f6t:"Annonces & vacances",f6d:"Informez élèves et parents en un clic.",
f9t:"Portail élève",f9d:"Chaque élève consulte son profil, ses présences et ses paiements via son propre lien.",
f11t:"Gestion du personnel",f11d:"Enseignants, secrétaires, rôles d'accès et suivi des salaires.",
f10t:"Gestion des formations",f10d:"Catalogue de formations, inscriptions, groupes et suivi des paiements.",
t_title:"Une solution pour chaque type d'établissement",t_sub:"Écoles, centres de soutien, formation professionnelle, langues : activez ce dont vous avez besoin.",
pick_type:"Choisissez votre type d'établissement :",c1:"Enfants, présence, paiements",c3:"Reçus et suivi des mensualités",
ty1:"Écoles privées",ty2:"Centres de soutien scolaire",ty3:"Formation professionnelle",ty4:"Centres de langues",ty5:"Crèches et maternelles",ty6:"Réseaux d'établissements",
tg_enrol:"Inscriptions",tg_parents:"Portail parents",tg_transport:"Transport",tg_groups:"Groupes et niveaux",tg_qr:"Présence QR",tg_monthly:"Mensualités",tg_formations:"Formations",tg_docs:"Attestations",tg_student:"Portail élève",tg_sites:"Multi-sites",tg_owner:"Vue propriétaire",tg_finance:"Finances",
f8t:"Cantine scolaire",f8d:"Menus, inscriptions et paiements de la cantine.",soon:"Bientôt",
f7t:"Inscrivez votre école sur SmartCities Maroc",f7d:"Rejoignez l'annuaire SmartCities Maroc et gagnez en visibilité auprès des familles.",
p_title:"Des tarifs clairs en dirhams",p_sub:"Choisissez selon la taille de votre école. Changez à tout moment.",
monthly:"Mensuel",yearly:"Annuel (2 mois offerts)",popular:"Le plus choisi",

a1:"Élèves, inscriptions, paiements",a2:"Présences & reçus",
try:"Essayer 15 jours",
h_title:"Démarrez en 3 étapes",st1t:"Créez votre école",st1d:"Inscription en 1 minute.",st2t:"Ajoutez vos élèves",st2d:"Saisie ou import simple.",st3t:"Encaissez et suivez",st3d:"Paiements, présences, transport.",
fin_t:"Prêt à simplifier la gestion de votre école ?",fin_d:"15 jours gratuits, sans carte bancaire.",per_m:" / mois",per_y:" / an",
feat_PARENT_PORTAL:"Portail parents",feat_STUDENT_PORTAL:"Portail élève",feat_QR_ATTENDANCE:"Présence par QR",feat_ANNOUNCEMENTS:"Annonces & vacances",feat_FINANCE_ANALYTICS:"Finance avancée",feat_TRANSPORT:"Transport scolaire",feat_DAILY_LOG:"Journal quotidien",
lim_students:"Jusqu'à {n} élèves",lim_children:"Jusqu'à {n} enfants",lim_students_unlimited:"Élèves illimités",lim_children_unlimited:"Enfants illimités",lim_branch_one:"1 établissement",lim_branches:"{n} établissements",lim_branches_two:"2 établissements",lim_branches_unlimited:"Multi-établissements",
yearly_note:"2 mois offerts",packs_error:"Les tarifs ne sont pas disponibles pour le moment.",packs_error_cta:"Créer mon compte",wa_label:"WhatsApp",lang_switch:"العربية"
};

export type Messages = Record<keyof typeof fr, string>;

const ar: Messages = {nav_pricing:"الأسعار",nav_login:"تسجيل الدخول",badge:"تجربة مجانية لمدة 15 يومًا",
h1:"أدِر مدرستك بسهولة، من التسجيل إلى النقل المدرسي.",
lead:"التلاميذ والمدفوعات والحضور بالرمز QR والنقل المدرسي وبوابة أولياء الأمور، كل ذلك في منصة واحدة وباللغتين العربية والفرنسية.",
cta1:"جرّب مجانًا لمدة 15 يومًا",cta2:"اكتشف المميزات",nocard:"بدون بطاقة مصرفية · بدون التزام",


f_title:"كل ما تحتاجه مدرستك",f_sub:"أدوات مصمَّمة للمدارس الخاصة ومراكز الدعم والتكوين ومعاهد اللغات والحضانات في المغرب.",
f1t:"بوابة أولياء الأمور",f1d:"يتابعون حضور أبنائهم ورصيدهم ونقلهم المدرسي عبر رابط بسيط.",
f2t:"الحضور بالرمز QR",f2d:"امسح الرمز فيُسجَّل الحضور فورًا، وتظهر الغيابات مباشرة.",
f3t:"النقل المدرسي",f3d:"الخطوط والمحطات والأوقات والسائقون والاشتراكات الشهرية.",
f4t:"المدفوعات والمالية",f4d:"التسجيل والمستحقات الشهرية والإيصالات ومتابعة المتأخرات.",
f5t:"تعدد المؤسسات",f5d:"عدة فروع مع رؤية شاملة واحدة للمالك.",
f6t:"الإعلانات والعطل",f6d:"أبلغ التلاميذ وأولياء الأمور بنقرة واحدة.",
f9t:"بوابة التلميذ",f9d:"يطّلع كل تلميذ على ملفه وحضوره ومدفوعاته عبر رابطه الخاص.",
f11t:"تدبير الموظفين",f11d:"الأساتذة والكتّاب وصلاحيات الولوج ومتابعة الأجور.",
f10t:"تدبير التكوينات",f10d:"لائحة التكوينات والتسجيل والمجموعات ومتابعة المدفوعات.",
t_title:"حل مناسب لكل أنواع المؤسسات التعليمية",t_sub:"مدارس ومراكز دعم وتكوين مهني ولغات: فعّل ما تحتاجه فقط.",
pick_type:"اختر نوع مؤسستك:",c1:"الأطفال والحضور والمدفوعات",c3:"الإيصالات ومتابعة المستحقات الشهرية",
ty1:"المدارس الخاصة",ty2:"مراكز الدعم التربوي",ty3:"مراكز التكوين المهني",ty4:"معاهد اللغات",ty5:"الحضانات والتعليم الأولي",ty6:"شبكات المؤسسات",
tg_enrol:"التسجيل",tg_parents:"بوابة الأولياء",tg_transport:"النقل",tg_groups:"المجموعات والمستويات",tg_qr:"حضور QR",tg_monthly:"المستحقات الشهرية",tg_formations:"التكوينات",tg_docs:"الشهادات",tg_student:"بوابة التلميذ",tg_sites:"فروع متعددة",tg_owner:"رؤية المالك",tg_finance:"المالية",
f8t:"المطعم المدرسي",f8d:"قوائم الوجبات وتسجيل التلاميذ ومدفوعات المطعم المدرسي.",soon:"قريبًا",
f7t:"سجّل مدرستك في SmartCities المغرب",f7d:"انضم إلى دليل SmartCities المغرب لتصل إلى مزيد من الأسر وتزداد مدرستك ظهورًا.",
p_title:"أسعار واضحة بالدرهم",p_sub:"اختر حسب حجم مدرستك، ويمكنك التغيير في أي وقت.",
monthly:"شهري",yearly:"سنوي (شهران مجانًا)",popular:"الأكثر اختيارًا",

a1:"التلاميذ والتسجيل والمدفوعات",a2:"الحضور والإيصالات",
try:"جرّب 15 يومًا",
h_title:"ابدأ في ثلاث خطوات",st1t:"أنشئ مدرستك",st1d:"التسجيل في دقيقة واحدة.",st2t:"أضف التلاميذ",st2d:"إدخال أو استيراد بسيط.",st3t:"حصّل المدفوعات وتابع",st3d:"المدفوعات والحضور والنقل.",
fin_t:"هل أنت مستعد لتبسيط إدارة مدرستك؟",fin_d:"15 يومًا مجانًا، بدون بطاقة مصرفية.",per_m:" / شهر",per_y:" / سنة",
feat_PARENT_PORTAL:"بوابة أولياء الأمور",feat_STUDENT_PORTAL:"بوابة التلميذ",feat_QR_ATTENDANCE:"حضور بالرمز QR",feat_ANNOUNCEMENTS:"الإعلانات والعطل",feat_FINANCE_ANALYTICS:"مالية متقدمة",feat_TRANSPORT:"النقل المدرسي",feat_DAILY_LOG:"السجل اليومي",
lim_students:"حتى {n} تلميذ",lim_children:"حتى {n} طفل",lim_students_unlimited:"عدد غير محدود من التلاميذ",lim_children_unlimited:"عدد غير محدود من الأطفال",lim_branch_one:"مؤسسة واحدة",lim_branches:"{n} مؤسسات",lim_branches_two:"مؤسستان",lim_branches_unlimited:"مؤسسات متعددة",
yearly_note:"شهران مجانًا",packs_error:"الأسعار غير متاحة حاليًا.",packs_error_cta:"أنشئ حسابي",wa_label:"واتساب",lang_switch:"Français"
};

export const messages: Record<Lang, Messages> = { fr, ar };
