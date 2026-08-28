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
  Calendar
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import useAuthStore from '@/store/useAuthStore';

interface SidebarProps {
  currentPath: string;
  role?: 'ADMIN' | 'SECRETARY' | 'SUPER_ADMIN';
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

  const toggleMenu = (menu: string) => {
    setExpandedMenus(prev =>
      prev.includes(menu)
        ? prev.filter(m => m !== menu)
        : [...prev, menu]
    );
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
      path: '/admin/presence',
      activeColor: 'bg-[#334155]/50 border-[#F472B6]',
      iconColor: 'text-[#F472B6]'
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
      ]
    },
    {
      id: 'recus',
      label: 'Reçus',
      icon: FileText,
      path: '/admin/finance/recu',
      activeColor: 'bg-[#334155]/50 border-[#2DD4BF]',
      iconColor: 'text-[#2DD4BF]'
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
      id: 'salles',
      label: 'Salles',
      icon: Building,
      path: '/admin/finance/salles',
      activeColor: 'bg-[#334155]/50 border-[#FBBF24]',
      iconColor: 'text-[#FBBF24]'
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
      id: 'recus',
      label: 'Reçus',
      icon: FileText,
      path: '/secretary/recus',
      activeColor: 'bg-[#334155]/50 border-[#2DD4BF]',
      iconColor: 'text-[#2DD4BF]'
    }
  ];

  const menuItems = (effectiveRole === 'ADMIN' || effectiveRole === 'SUPER_ADMIN') ? adminMenuItems : secretaryMenuItems;

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

  return (
    <>
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 rounded-xl bg-[#1e293b] text-white shadow-lg border border-[#334155]"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-72 text-slate-300
        flex flex-col border-r border-[#334155]/50 shadow-2xl
        transition-transform duration-300 ease-spring
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
        style={{
          background: 'radial-gradient(circle at 0% 0%, #2e3b4e 0%, #1e293b 100%)'
        }}
      >
        <div className="p-6">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 shadow-inner backdrop-blur-sm">
            {profile.logo ? (
              <div className="w-12 h-12 bg-white rounded-xl p-1.5 shadow-sm flex-shrink-0">
                <img src={profile.logo} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
                <GraduationCap size={24} className="text-white" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-white truncate text-sm">
                {profile.schoolName}
              </h1>
              <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                {effectiveRole === 'SUPER_ADMIN' ? 'Maintenance (Super Admin)' : (effectiveRole === 'SECRETARY' ? 'Secrétaire' : (profile.director || 'Administrateur'))}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-6 space-y-1 scrollbar-hide">
          <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 mt-2">Menu Principal</p>

          {menuItems.map((item) => {
            const active = isActive(item);
            const activeClass = active
              ? `${item.activeColor.split(' ')[0]} text-white shadow-md border-r-4 ${item.activeColor.split(' ')[1].replace('border-', 'border-')}`
              : 'text-slate-400 hover:bg-white/5 hover:text-white';

            return (
              <li key={item.id} className="list-none mb-1">
                {item.submenu ? (
                  <div className="space-y-1">
                    <button
                      onClick={() => toggleMenu(item.id)}
                      className={`
                        w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group
                        ${active || expandedMenus.includes(item.id)
                          ? 'bg-white/5 text-white'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg transition-colors ${active || expandedMenus.includes(item.id) ? 'bg-white/10' : 'bg-white/5'}`}>
                          <item.icon size={18} className={active || expandedMenus.includes(item.id) ? item.iconColor : 'text-slate-500'} />
                        </div>
                        <span className="font-semibold text-sm">{item.label}</span>
                      </div>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${expandedMenus.includes(item.id) ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {expandedMenus.includes(item.id) && (
                      <ul className="ml-[3.25rem] space-y-1 border-l-2 border-dashed border-[#334155] pl-3 py-1">
                        {item.submenu.map((sub: any) => {
                          const isSubActive = currentPath === sub.path;
                          return (
                            <li key={sub.path}>
                              <button
                                onClick={() => handleNavigation(sub.path)}
                                className={`
                                  w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 relative
                                  ${isSubActive
                                    ? 'text-white font-bold bg-white/10'
                                    : 'text-slate-500 hover:text-white'
                                  }
                                `}
                              >
                                {isSubActive && (
                                  <span className={`absolute -left-[19px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${item.iconColor.replace('text-', 'bg-')}`}></span>
                                )}
                                {sub.label}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => handleNavigation(item.path!)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden
                      ${activeClass}
                    `}
                  >
                    <div className={`p-2 rounded-lg transition-colors ${active ? 'bg-white/10' : 'bg-white/5 group-hover:bg-white/10'}`}>
                      <item.icon size={18} className={active ? item.iconColor : 'text-slate-500 group-hover:text-slate-300 transition-transform'} />
                    </div>
                    <span className="font-semibold text-sm">{item.label}</span>
                  </button>
                )}
              </li>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#334155]/50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 text-red-400 hover:bg-red-500/10 transition-all group shadow-sm border border-white/5"
          >
            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold text-sm">Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  );
}
