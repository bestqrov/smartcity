'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sun, Moon, Cloud, Bell, Search, Menu, Timer, Sparkles } from 'lucide-react';
import axios from 'axios';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import useAuthStore from '@/store/useAuthStore';

export default function TopBar() {
    const { profile } = useSchoolProfile();
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [prayerTimes, setPrayerTimes] = useState<any>(null);
    const [nextPrayer, setNextPrayer] = useState<any>(null);
    const [adminName, setAdminName] = useState('');
    const [adminRole, setAdminRole] = useState('Administrateur');

    const pathname = usePathname();

    const user = useAuthStore(state => state.user);

    // Load theme and user info
    useEffect(() => {
        const savedTheme = localStorage.getItem('app-theme') as 'light' | 'dark';
        if (savedTheme) {
            setTheme(savedTheme);
            document.documentElement.classList.toggle('dark', savedTheme === 'dark');
        }

        if (user) {
            const name = `${user.name} ${user.surname || ''}`.trim();
            setAdminName(name);
            setAdminRole(user.role === 'ADMIN' ? 'Administrateur' : 'Secrétaire');
        }

        // Fetch Athan Times
        const fetchAthan = async (lat: number, lon: number) => {
            try {
                const date = new Date();
                const res = await axios.get(`https://api.aladhan.com/v1/timings/${Math.floor(date.getTime() / 1000)}?latitude=${lat}&longitude=${lon}&method=3`);
                const timings = res.data.data.timings;
                setPrayerTimes(timings);

                // Identify next prayer
                const now = date.getHours() * 60 + date.getMinutes();
                const prayers = [
                    { name: 'Fajr', time: timings.Fajr },
                    { name: 'Dhuhr', time: timings.Dhuhr },
                    { name: 'Asr', time: timings.Asr },
                    { name: 'Maghrib', time: timings.Maghrib },
                    { name: 'Isha', time: timings.Isha }
                ];

                const upcoming = prayers.find(p => {
                    const [h, m] = p.time.split(':').map(Number);
                    return (h * 60 + m) > now;
                }) || prayers[0];

                setNextPrayer(upcoming);
            } catch (error) {
                console.error('Failed to fetch Athan times:', error);
            }
        };

        const getFallbackLocation = async () => {
            try {
                const res = await axios.get('https://ipapi.co/json/');
                if (res.data.latitude && res.data.longitude) {
                    fetchAthan(res.data.latitude, res.data.longitude);
                }
            } catch (e) {
                fetchAthan(33.5731, -7.5898); // Casablanca
            }
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => fetchAthan(position.coords.latitude, position.coords.longitude),
                () => getFallbackLocation(),
                { timeout: 5000 }
            );
        } else {
            getFallbackLocation();
        }
    }, [pathname, user]);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('app-theme', newTheme);
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
    };

    return (
        <header className="h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 fixed top-0 right-0 left-64 z-20 px-6 flex items-center justify-between transition-all duration-300">
            {/* Left: Search or Breadcrumbs */}
            <div className="flex items-center gap-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        className="pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border-none rounded-full text-sm focus:ring-2 focus:ring-blue-500 w-64 transition-all dark:text-white dark:placeholder-gray-400"
                    />
                </div>
            </div>

            {/* Right: Actions & Profile */}
            <div className="flex items-center gap-6">
                {/* Athan Widget */}
                {nextPrayer && (
                    <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 text-emerald-700 dark:text-emerald-300 rounded-2xl text-sm font-bold shadow-sm border border-emerald-100/50 dark:border-emerald-800/50 group hover:scale-105 transition-all cursor-pointer">
                        <div className="p-1.5 bg-white/80 dark:bg-white/10 rounded-xl shadow-sm text-emerald-600">
                            <Timer size={18} className="group-hover:rotate-12 transition-transform" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-widest text-emerald-500/80 leading-none mb-1">Prochain Athan</span>
                            <div className="flex items-center gap-2">
                                <span className="font-extrabold text-emerald-900 dark:text-emerald-100">{nextPrayer.name}</span>
                                <span className="w-1 h-1 bg-emerald-300 rounded-full"></span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-black">{nextPrayer.time}</span>
                            </div>
                        </div>
                        <Sparkles size={14} className="text-amber-400 animate-pulse ml-1" />
                    </div>
                )}

                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                    title={theme === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair'}
                >
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>

                {/* Notifications */}
                <button className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors relative">
                    <Bell size={20} />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
                </button>

                {/* Vertical Divider */}
                <div className="h-8 w-px bg-gray-200 dark:bg-gray-700"></div>

                {/* Admin Profile */}
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-none">{adminName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{adminRole}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 p-0.5 cursor-pointer">
                        <div className="w-full h-full rounded-full bg-white dark:bg-gray-800 p-0.5 flex items-center justify-center overflow-hidden">
                            {profile.logo ? (
                                <img
                                    src={profile.logo}
                                    alt="School Logo"
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <img
                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(adminName || 'User')}&background=random`}
                                    alt={adminName}
                                    className="w-full h-full rounded-full object-cover"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
