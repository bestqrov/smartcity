'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  FileText,
  DollarSign,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Building,
  Calendar,
  Megaphone,
  Bus,
  Package,
  Briefcase,
  BookOpen,
  ClipboardList,
  PartyPopper,
  Layers
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import useAuthStore from '@/store/useAuthStore';
import { applyInstitutionType, getInstitutionTypeConfig } from '@/lib/institutionTypes';

interface SidebarProps {
  currentPath: string;
  role?: 'ADMIN' | 'SECRETARY' | 'SUPER_ADMIN' | 'OWNER';
}

export function Sidebar({ currentPath, role }: SidebarProps) {
  const router = useRouter();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const { profile } = useSchoolProfile();
  const [adminName, setAdminName] = useState('Utilisateur');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const user = useAuthStore(state => state.user);
  const effectiveRole = role || user?.role || 'ADMIN';

  useEffect(() => {
    if (user) {
      setAdminName(`${user.name} ${user.surname || ''}`.trim());
    }
  }, [currentPath, user]);

  // Opens `add` and forgets `remove` (an active sub-menu is open unless explicitly closed).
  const toggleMenu = (add: string, remove: string) => {
    setExpandedMenus(prev => [...prev.filter(m => m !== remove && m !== add), add]);
  };

  const adminMenuItems = [
    {
      id: 'dashboard',
      label: 'Tableau de bord',
      icon: LayoutDashboard,
      path: '/admin',
      activeColor: 'bg-[#334155]/50 border-[#60A5FA]',
      iconColor: 'text-[#60A5FA]'
    },
    {
      id: 'soutien',
      label: 'Soutien Scolaire',
      icon: GraduationCap,
      activeColor: 'bg-[#334155]/50 border-[#818CF8]',
      iconColor: 'text-[#818CF8]',
      submenu: [
        { label: 'Etat Soutien', path: '/admin/soutien-scolaire' },
        { label: 'Students', path: '/admin/students' },
        { label: 'Inscriptions', path: '/admin/inscriptions' },
        { label: 'Import Excel', path: '/admin/inscriptions/import' },
        { label: 'Groups', path: '/admin/groups' },
      ]
    },
    {
      id: 'formation',
      label: 'Formation Pro',
      icon: FileText,
      activeColor: 'bg-[#334155]/50 border-[#C084FC]',
      iconColor: 'text-[#C084FC]',
      submenu: [
        { label: 'Etat Formation', path: '/admin/formation-pro' },
        { label: 'Nouvelle Inscription', path: '/admin/formation-pro/inscription' },
        { label: 'Nouvelle Formation', path: '/admin/formation-pro/new' },
      ]
    },
    {
      id: 'presence',
      label: 'Présence',
      icon: Calendar,
      activeColor: 'bg-[#334155]/50 border-[#F472B6]',
      iconColor: 'text-[#F472B6]',
      submenu: [
        { label: 'Présence de la semaine', path: '/admin/presence' },
        { label: 'Scanner QR', path: '/admin/attendance/scan' },
      ]
    },
    {
      id: 'personnel',
      label: 'Personnel',
      icon: Users,
      activeColor: 'bg-[#334155]/50 border-[#FB923C]',
      iconColor: 'text-[#FB923C]',
      submenu: [
        { label: 'Utilisateurs', path: '/admin/users' },
        { label: 'Secrétaire', path: '/admin/secretaire' },
        { label: 'Professeur', path: '/admin/teachers' },
      ]
    },
    {
      id: 'finance',
      label: 'Finance',
      icon: DollarSign,
      activeColor: 'bg-[#334155]/50 border-[#34D399]',
      iconColor: 'text-[#34D399]',
      submenu: [
        { label: 'Paiements', path: '/admin/finance/paiements' },
        { label: 'Transactions', path: '/admin/finance/transactions' },
        { label: 'Prix', path: '/admin/finance/prix' },
        { label: 'Reçus', path: '/admin/finance/recu' },
        { label: 'Salles', path: '/admin/finance/salles' },
      ]
    },
    {
      id: 'communication',
      label: 'Communication',
      icon: Megaphone,
      activeColor: 'bg-[#334155]/50 border-[#F59E0B]',
      iconColor: 'text-[#F59E0B]',
      submenu: [
        { label: 'Annonces', path: '/admin/annonces' },
        { label: 'Vacances', path: '/admin/vacances' },
      ]
    },
    {
      id: 'grades',
      label: 'Notes',
      icon: ClipboardList,
      path: '/admin/grades',
      activeColor: 'bg-[#334155]/50 border-[#FBBF24]',
      iconColor: 'text-[#FBBF24]'
    },
    {
      id: 'activities',
      label: 'Activités',
      icon: PartyPopper,
      path: '/admin/activities',
      activeColor: 'bg-[#334155]/50 border-[#F472B6]',
      iconColor: 'text-[#F472B6]'
    },
    {
      id: 'homework',
      label: 'Devoirs',
      icon: BookOpen,
      path: '/admin/homework',
      activeColor: 'bg-[#334155]/50 border-[#2DD4BF]',
      iconColor: 'text-[#2DD4BF]'
    },
    {
      id: 'parents',
      label: 'Parents',
      icon: Users,
      activeColor: 'bg-[#334155]/50 border-[#A78BFA]',
      iconColor: 'text-[#A78BFA]',
      submenu: [
        { label: 'Liste des parents', path: '/admin/parents' },
        { label: 'Accès parents', path: '/admin/parents/access' },
      ]
    },
    {
      id: 'transport',
      label: 'Transport',
      icon: Bus,
      path: '/admin/transport',
      activeColor: 'bg-[#334155]/50 border-[#38BDF8]',
      iconColor: 'text-[#38BDF8]'
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: FileText,
      path: '/admin/documents',
      activeColor: 'bg-[#334155]/50 border-[#22D3EE]',
      iconColor: 'text-[#22D3EE]'
    },
    {
      id: 'settings',
      label: 'Paramètres',
      icon: Settings,
      path: '/admin/settings',
      activeColor: 'bg-[#334155]/50 border-[#9CA3AF]',
      iconColor: 'text-[#9CA3AF]'
    }
  ];

  /* Owner Menu Items (cross-branch) */
  const ownerMenuItems = [
    {
      id: 'branches',
      label: 'Tous les établissements',
      icon: Building,
      path: '/admin/branches',
      activeColor: 'bg-[#334155]/50 border-[#60A5FA]',
      iconColor: 'text-[#60A5FA]'
    },
    ...adminMenuItems
  ];

  /* Secretary Menu Items */
  const secretaryMenuItems = [
    {
      id: 'dashboard',
      label: 'Tableau de bord',
      icon: LayoutDashboard,
      path: '/secretary',
      activeColor: 'bg-[#334155]/50 border-[#60A5FA]',
      iconColor: 'text-[#60A5FA]'
    },
    {
      id: 'soutien',
      label: 'Soutien Scolaire',
      icon: GraduationCap,
      activeColor: 'bg-[#334155]/50 border-[#818CF8]',
      iconColor: 'text-[#818CF8]',
      submenu: [
        { label: 'Inscriptions', path: '/secretary/inscriptions' },
        { label: 'Import Excel', path: '/secretary/inscriptions/import' },
      ]
    },
    {
      id: 'presence',
      label: 'Présence',
      icon: Calendar,
      activeColor: 'bg-[#334155]/50 border-[#F472B6]',
      iconColor: 'text-[#F472B6]',
      submenu: [
        { label: 'Présence de la semaine', path: '/secretary/presence' },
        { label: 'Scanner QR', path: '/secretary/attendance/scan' },
      ]
    },
    {
      id: 'formation',
      label: 'Formation Pro',
      icon: FileText,
      path: '/secretary/formation-pro',
      activeColor: 'bg-[#334155]/50 border-[#C084FC]',
      iconColor: 'text-[#C084FC]'
    },
    {
      id: 'grades',
      label: 'Notes',
      icon: ClipboardList,
      path: '/secretary/grades',
      activeColor: 'bg-[#334155]/50 border-[#FBBF24]',
      iconColor: 'text-[#FBBF24]'
    },
    {
      id: 'activities',
      label: 'Activités',
      icon: PartyPopper,
      path: '/secretary/activities',
      activeColor: 'bg-[#334155]/50 border-[#F472B6]',
      iconColor: 'text-[#F472B6]'
    },
    {
      id: 'homework',
      label: 'Devoirs',
      icon: BookOpen,
      path: '/secretary/homework',
      activeColor: 'bg-[#334155]/50 border-[#2DD4BF]',
      iconColor: 'text-[#2DD4BF]'
    },
    {
      id: 'parents-access',
      label: 'Accès parents',
      icon: Users,
      path: '/secretary/parents/access',
      activeColor: 'bg-[#334155]/50 border-[#A78BFA]',
      iconColor: 'text-[#A78BFA]'
    },
    {
      id: 'recus',
      label: 'Reçus',
      icon: FileText,
      path: '/secretary/recus',
      activeColor: 'bg-[#334155]/50 border-[#2DD4BF]',
      iconColor: 'text-[#2DD4BF]'
    }
  ];

  const superAdminMenuItems = [
    {
      id: 'platform',
      label: 'Tableau de bord',
      icon: LayoutDashboard,
      path: '/admin/platform',
      activeColor: 'bg-[#334155]/50 border-[#60A5FA]',
      iconColor: 'text-[#60A5FA]'
    },
    {
      id: 'schools',
      label: 'Écoles',
      icon: Building,
      path: '/admin/schools',
      activeColor: 'bg-[#334155]/50 border-[#F87171]',
      iconColor: 'text-[#F87171]'
    },
    {
      id: 'packs',
      label: 'Packs',
      icon: Package,
      path: '/admin/packs',
      activeColor: 'bg-[#334155]/50 border-[#FBBF24]',
      iconColor: 'text-[#FBBF24]'
    },
    {
      id: 'sales-agents',
      label: 'Commerciaux',
      icon: Briefcase,
      path: '/admin/sales-agents',
      activeColor: 'bg-[#334155]/50 border-[#34D399]',
      iconColor: 'text-[#34D399]'
    }
    // Platform-only: the super admin doesn't manage what happens inside a school.
  ];

  const menuItems = effectiveRole === 'OWNER'
    ? ownerMenuItems
    : effectiveRole === 'SUPER_ADMIN'
    ? superAdminMenuItems
    : effectiveRole === 'ADMIN' ? adminMenuItems : secretaryMenuItems;

  const institutionType = effectiveRole === 'SUPER_ADMIN' ? null : profile.institutionType;
  const typeConfig = getInstitutionTypeConfig(institutionType);
  // Hidden ids, relabels and ordering of the institution type apply first; entries are then sorted into the groups.
  const visibleMenuItems: any[] = [
    ...applyInstitutionType(menuItems as any[], institutionType),
    ...typeConfig.comingSoon.map((entry) => ({
      ...entry,
      icon: BookOpen,
      comingSoon: true,
    })),
  ];
  const groupedMenu = buildGroups(visibleMenuItems);

  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '[]');
      if (Array.isArray(saved)) setCollapsedGroups(saved.filter((g) => typeof g === 'string'));
    } catch {
      // storage blocked or corrupted: every group stays open
    }
  }, []);
  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => {
      const next = prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id];
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        // not persisted
      }
      return next;
    });
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    useAuthStore.getState().logout();
  };

  const isActive = (item: any) => {
    if (item.path) return currentPath === item.path;
    if (item.submenu) return item.submenu.some((sub: any) => currentPath === sub.path);
    return false;
  };

  const roleLabel = effectiveRole === 'SUPER_ADMIN' ? 'Maintenance (Super Admin)' : (effectiveRole === 'SECRETARY' ? 'Secrétaire' : (effectiveRole === 'OWNER' ? 'Propriétaire' : (profile.director || 'Administrateur')));

  return (
    <>
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className={`lg:hidden fixed top-3 z-50 w-11 h-11 flex items-center justify-center rounded-2xl bg-white text-gray-900 shadow-lg border border-gray-200 dark:bg-vib-panel dark:text-white dark:border-white/10 transition-all duration-300 ${isMobileMenuOpen ? 'left-[calc(min(18rem,85vw)+0.5rem)]' : 'left-4'}`}
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-72 max-w-[85vw] shrink-0
        flex flex-col bg-white text-gray-700 shadow-2xl
        dark:bg-vib-panel dark:text-gray-300 dark:border-r dark:border-white/5
        lg:rounded-3xl lg:shadow-sm lg:dark:border lg:dark:shadow-none
        transition-transform duration-300 ease-spring
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      >
        <div className="p-4">
          <div className="flex items-center gap-3">
            {profile.logo ? (
              <div className="w-10 h-10 bg-white rounded-xl p-1 shadow-sm border border-gray-100 dark:border-white/10 flex-shrink-0">
                <img src={profile.logo} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-vib-indigo rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                <GraduationCap size={20} className="text-white" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 dark:text-white truncate text-sm">
                {profile.schoolName}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate mt-0.5">{roleLabel}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-3 scrollbar-hide" aria-label="Menu principal">
          {groupedMenu.map((group) => {
            const collapsed = collapsedGroups.includes(group.id);
            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={!collapsed}
                  className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  <span>{group.label}</span>
                  <ChevronDown size={12} className={`transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
                </button>
                {!collapsed && (
                  <ul className="mt-0.5 space-y-0.5">
                    {group.items.map((item: any) => {
                      const active = isActive(item);
                      const open = expandedMenus.includes(item.key) || (active && !expandedMenus.includes(`closed:${item.key}`));
                      const tint = active ? { backgroundColor: `${group.color}1A` } : undefined;
                      const chip = (
                        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: group.color }}>
                          <item.icon size={15} aria-hidden="true" />
                        </span>
                      );
                      if (item.submenu) {
                        return (
                          <li key={item.key}>
                            <button
                              type="button"
                              onClick={() => toggleMenu(open ? `closed:${item.key}` : item.key, open ? item.key : `closed:${item.key}`)}
                              aria-expanded={open}
                              style={tint}
                              className={`w-full flex items-center justify-between gap-2.5 px-2 py-2 rounded-xl transition-colors ${active ? 'font-bold text-gray-900 dark:text-white' : 'font-medium hover:bg-gray-50 dark:hover:bg-white/5'}`}
                            >
                              <span className="flex min-w-0 items-center gap-2.5">
                                {chip}
                                <span className="truncate text-[13px]">{item.label}</span>
                              </span>
                              <ChevronDown size={14} className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                            </button>
                            {open && (
                              <ul className="ml-[1.6rem] border-l border-gray-200 dark:border-white/10 pl-3 py-0.5">
                                {item.submenu.map((sub: any) => {
                                  const isSubActive = currentPath === sub.path;
                                  return (
                                    <li key={sub.path}>
                                      <button
                                        type="button"
                                        onClick={() => handleNavigation(sub.path)}
                                        aria-current={isSubActive ? 'page' : undefined}
                                        style={isSubActive ? { backgroundColor: `${group.color}1A`, color: group.color } : undefined}
                                        className={`w-full text-left px-2.5 py-2.5 lg:py-1.5 rounded-lg text-[13px] transition-colors ${isSubActive ? 'font-bold' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                                      >
                                        {sub.label}
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </li>
                        );
                      }
                      return (
                        <li key={item.key}>
                          <button
                            type="button"
                            onClick={() => !item.comingSoon && handleNavigation(item.path!)}
                            disabled={item.comingSoon}
                            aria-current={active ? 'page' : undefined}
                            style={tint}
                            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors ${item.comingSoon ? 'opacity-60 cursor-not-allowed' : active ? 'font-bold text-gray-900 dark:text-white' : 'font-medium hover:bg-gray-50 dark:hover:bg-white/5'}`}
                          >
                            {chip}
                            <span className="truncate text-[13px]">{item.label}</span>
                            {item.comingSoon && (
                              <span className="ml-auto rounded-full bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold">Bientôt</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100 dark:border-white/5 space-y-2">
          {user && user.role !== 'SALES_AGENT' && user.salesAgent && (
            <button
              onClick={() => handleNavigation('/agent')}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20 transition-colors"
            >
              <Briefcase size={16} />
              <span className="font-semibold text-[13px]">Espace commercial</span>
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 transition-colors group"
          >
            <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold text-[13px]">Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// ---- grouping ----------------------------------------------------------------------------------------------

const COLLAPSED_KEY = 'sidebar-collapsed-groups';

const GROUPS = [
  { id: 'accueil', label: 'Accueil', color: '#4F46E5' },
  { id: 'eleves', label: 'Élèves', color: '#059669' },
  { id: 'pedagogie', label: 'Pédagogie', color: '#7C3AED' },
  { id: 'vie', label: 'Vie scolaire', color: '#DB2777' },
  { id: 'finance', label: 'Finance', color: '#D97706' },
  { id: 'etablissement', label: 'Établissement', color: '#475569' },
] as const;
type GroupId = (typeof GROUPS)[number]['id'];

// Group of each menu entry (by id); anything unknown lands in Établissement so nothing ever disappears.
const ITEM_GROUP: Record<string, GroupId> = {
  dashboard: 'accueil',
  platform: 'accueil',
  soutien: 'eleves',
  formation: 'eleves',
  parents: 'eleves',
  'parents-access': 'eleves',
  presence: 'pedagogie',
  grades: 'pedagogie',
  homework: 'pedagogie',
  activities: 'vie',
  communication: 'vie',
  'daily-log': 'vie',
  finance: 'finance',
  recus: 'finance',
  personnel: 'etablissement',
  transport: 'etablissement',
  documents: 'etablissement',
  settings: 'etablissement',
  branches: 'etablissement',
  schools: 'etablissement',
  packs: 'etablissement',
  'sales-agents': 'etablissement',
};

// Sub-entries that belong to another group than their parent menu, with their own icon.
const SUB_GROUP: Record<string, { group: GroupId; icon: any }> = {
  '/admin/groups': { group: 'pedagogie', icon: Layers },
  '/admin/teachers': { group: 'pedagogie', icon: Briefcase },
};

function buildGroups(items: any[]) {
  const buckets: Record<string, any[]> = {};
  const push = (group: GroupId, entry: any) => {
    (buckets[group] ||= []).push(entry);
  };
  for (const item of items) {
    const home: GroupId = ITEM_GROUP[item.id] ?? 'etablissement';
    if (!item.submenu) {
      push(home, { ...item, key: item.id });
      continue;
    }
    // Split the sub-menu: entries moved to another group become plain links there.
    const stay: any[] = [];
    for (const sub of item.submenu) {
      const moved = SUB_GROUP[sub.path];
      if (moved && moved.group !== home) {
        push(moved.group, { id: `${item.id}:${sub.path}`, key: `${item.id}:${sub.path}`, label: sub.label, path: sub.path, icon: moved.icon });
      } else {
        stay.push(sub);
      }
    }
    if (stay.length > 0) push(home, { ...item, key: item.id, submenu: stay });
  }
  const pedagogie = buckets.pedagogie;
  if (pedagogie) pedagogie.sort((a, b) => pedagogieRank(a) - pedagogieRank(b));
  return GROUPS.filter((g) => buckets[g.id]?.length).map((g) => ({ ...g, items: buckets[g.id] }));
}

// Pédagogie order asked by the school owner: Professeurs, Présence, Devoirs, Notes, then Groupes.
function pedagogieRank(entry: any): number {
  const key = `${entry.id ?? ''} ${entry.path ?? ''}`;
  if (/teacher/.test(key)) return 0;
  if (/presence|attendance/.test(key)) return 1;
  if (/homework/.test(key)) return 2;
  if (/grades/.test(key)) return 3;
  if (/groups/.test(key)) return 4;
  return 5;
}
