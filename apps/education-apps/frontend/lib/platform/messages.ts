// Strings of the super admin platform dashboard. `ar` is Modern Standard Arabic.
// Terms shared with the sales agent space (periods, institution types, layout toggles) come from agentMessages.
import type { SchoolStatus } from '@/lib/services/schools';
import { agentMessages, type AgentLang } from '@/lib/agent/messages';

const fr = {
    ...agentMessages.fr,
    brand: 'Espace super admin',
    banner_title: 'Tableau de bord plateforme',
    banner_sub: (schools: number, agents: number) => `${schools} école${schools > 1 ? 's' : ''} · ${agents} commercia${agents > 1 ? 'ux' : 'l'}`,

    // sidebar
    nav_dashboard: 'Tableau de bord',
    nav_schools: 'Écoles',
    nav_packs: 'Packs',
    nav_agents: 'Commerciaux',

    // filters
    filter_school_status: 'Statut école',
    filter_agent: 'Commercial',
    no_agent: 'Sans commercial',

    // KPIs
    kpi_schools: 'Écoles',
    kpi_active: 'Actives',
    kpi_new_month: 'Nouvelles inscriptions ce mois',
    kpi_revenue_month: "Chiffre d'affaires ce mois",
    kpi_revenue_total: "Chiffre d'affaires total",
    kpi_commissions_due: 'Commissions dues aux commerciaux',
    kpi_trials: 'Essais qui expirent sous 7 jours',
    kpi_trials_sub: 'sans paiement',
    kpi_agents_owed: (n: number) => `${n} commercia${n > 1 ? 'ux' : 'l'} à payer`,
    payments_count: (n: number) => `${n} paiement${n > 1 ? 's' : ''}`,
    last_month_value: (value: string) => `Mois dernier : ${value}`,

    // detail panels
    detail_new: (month: string) => `Nouvelles inscriptions — ${month}`,
    detail_revenue: (month: string) => `Paiements — ${month}`,
    detail_trials: 'Essais qui expirent sous 7 jours (sans paiement)',
    no_new: 'Aucune nouvelle inscription ce mois-ci.',
    no_month_payment: 'Aucun paiement ce mois-ci.',
    no_trials: "Aucun essai n'expire dans les 7 prochains jours.",
    days_left: (n: number) => (n <= 0 ? "aujourd'hui" : n === 1 ? 'demain' : `dans ${n} jours`),

    // charts
    chart_revenue_trend: "Évolution mensuelle du chiffre d'affaires (12 mois)",
    chart_schools_type: "Écoles par type d'établissement",
    chart_schools_pack: 'Écoles par pack',
    chart_schools_status: 'Écoles par statut',
    chart_revenue_period: "Chiffre d'affaires par période",
    chart_top_agents: "Meilleurs commerciaux par chiffre d'affaires apporté",

    // tables
    tab_schools: 'Écoles',
    tab_payments: 'Paiements',
    tab_agents: 'Commerciaux',
    manage_schools: 'Gérer les écoles',
    manage_agents: 'Gérer les commerciaux',
    col_type: 'Type',
    col_agent: 'Commercial',
    col_trial_end: "Fin d'essai",
    col_avatar: 'Photo',
    col_name: 'Nom',
    col_code: 'Code',
    col_schools: 'Écoles',
    col_revenue: 'CA apporté',
    col_commissions: 'Commissions',
    col_balance: 'Solde dû',
    house: 'Maison',
    inactive: 'Inactif',
    no_schools: 'Aucune école.',
    no_payments: 'Aucun paiement.',
    no_agents: 'Aucun commercial.',
    balance_note: 'Le solde dû est global (il ne dépend pas des filtres).',

    school_status: { PENDING: 'En attente', ACTIVE: 'Active', SUSPENDED: 'Suspendue' } as Record<SchoolStatus, string>,
};

export type PlatformMessages = typeof fr;

const ar: PlatformMessages = {
    ...agentMessages.ar,
    brand: 'فضاء المشرف العام',
    banner_title: 'لوحة تحكم المنصة',
    banner_sub: (schools: number, agents: number) => `عدد المؤسسات: ${schools} · عدد المندوبين: ${agents}`,

    nav_dashboard: 'لوحة التحكم',
    nav_schools: 'المؤسسات',
    nav_packs: 'الباقات',
    nav_agents: 'المندوبون التجاريون',

    filter_school_status: 'حالة المؤسسة',
    filter_agent: 'المندوب التجاري',
    no_agent: 'بدون مندوب',

    kpi_schools: 'المؤسسات',
    kpi_active: 'النشطة',
    kpi_new_month: 'التسجيلات الجديدة هذا الشهر',
    kpi_revenue_month: 'رقم المعاملات هذا الشهر',
    kpi_revenue_total: 'إجمالي رقم المعاملات',
    kpi_commissions_due: 'العمولات المستحقة للمندوبين',
    kpi_trials: 'فترات تجريبية تنتهي خلال 7 أيام',
    kpi_trials_sub: 'دون أي دفعة',
    kpi_agents_owed: (n: number) => `عدد المندوبين المستحقين: ${n}`,
    payments_count: (n: number) => `عدد الدفعات: ${n}`,
    last_month_value: (value: string) => `الشهر الماضي: ${value}`,

    detail_new: (month: string) => `التسجيلات الجديدة — ${month}`,
    detail_revenue: (month: string) => `الدفعات — ${month}`,
    detail_trials: 'فترات تجريبية تنتهي خلال 7 أيام (دون أي دفعة)',
    no_new: 'لا توجد تسجيلات جديدة هذا الشهر.',
    no_month_payment: 'لا توجد دفعات هذا الشهر.',
    no_trials: 'لا تنتهي أي فترة تجريبية خلال الأيام السبعة القادمة.',
    days_left: (n: number) => (n <= 0 ? 'اليوم' : n === 1 ? 'غدًا' : n === 2 ? 'بعد يومين' : n <= 10 ? `بعد ${n} أيام` : `بعد ${n} يومًا`),

    chart_revenue_trend: 'التطور الشهري لرقم المعاملات (12 شهرًا)',
    chart_schools_type: 'المؤسسات حسب النوع',
    chart_schools_pack: 'المؤسسات حسب الباقة',
    chart_schools_status: 'المؤسسات حسب الحالة',
    chart_revenue_period: 'رقم المعاملات حسب المدة',
    chart_top_agents: 'أفضل المندوبين حسب رقم المعاملات المحقَّق',

    tab_schools: 'المؤسسات',
    tab_payments: 'الدفعات',
    tab_agents: 'المندوبون التجاريون',
    manage_schools: 'إدارة المؤسسات',
    manage_agents: 'إدارة المندوبين',
    col_type: 'النوع',
    col_agent: 'المندوب التجاري',
    col_trial_end: 'نهاية الفترة التجريبية',
    col_avatar: 'الصورة',
    col_name: 'الاسم',
    col_code: 'الرمز',
    col_schools: 'المؤسسات',
    col_revenue: 'رقم المعاملات المحقَّق',
    col_commissions: 'العمولات',
    col_balance: 'الرصيد المستحق',
    house: 'الشركة',
    inactive: 'غير نشط',
    no_schools: 'لا توجد مؤسسات.',
    no_payments: 'لا توجد دفعات.',
    no_agents: 'لا يوجد مندوبون.',
    balance_note: 'الرصيد المستحق إجمالي (لا يتأثر بعوامل التصفية).',

    school_status: { PENDING: 'قيد الانتظار', ACTIVE: 'نشطة', SUSPENDED: 'موقوفة' },
};

export const platformMessages: Record<AgentLang, PlatformMessages> = { fr, ar };
