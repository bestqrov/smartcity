import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import type { Lang, Messages } from '@/lib/landing/messages';

interface Props {
    m: Messages;
    lang: Lang;
    onLangChange: (lang: Lang) => void;
}

export default function LandingNav({ m, lang, onLangChange }: Props) {
    return (
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <Link href="/" className="flex items-center gap-2 text-xl font-extrabold">
                <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-indigo-400 to-violet-500 text-white">
                    <GraduationCap size={18} />
                </span>
                Smart School
            </Link>
            <div className="flex items-center gap-2">
                <a href="#pricing" className="hidden rounded-full border border-[#22294a] bg-[#131a30] px-4 py-1.5 text-sm font-semibold text-slate-200 hover:bg-[#1a2342] sm:inline-block">
                    {m.nav_pricing}
                </a>
                <button
                    type="button"
                    onClick={() => onLangChange(lang === 'fr' ? 'ar' : 'fr')}
                    className="rounded-full border border-[#22294a] bg-[#131a30] px-4 py-1.5 text-sm font-semibold text-slate-200 hover:bg-[#1a2342]"
                    aria-label="Changer de langue / تغيير اللغة"
                >
                    {m.lang_switch}
                </button>
                <Link href="/login" className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 px-4 py-2 text-sm font-bold text-white">
                    {m.nav_login}
                </Link>
            </div>
        </nav>
    );
}
