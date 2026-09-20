import type { Messages } from '@/lib/landing/messages';

export default function Hero({ m }: { m: Messages }) {
    return (
        <header className="bg-[radial-gradient(1200px_500px_at_70%_-10%,#312e81_0,transparent_60%)]">
            <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 lg:grid-cols-[1.1fr_.9fr]">
                <div>
                    <span className="inline-block rounded-full bg-amber-400/15 px-3 py-1 text-sm font-bold text-amber-400">
                        {m.badge}
                    </span>
                    <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">{m.h1}</h1>
                    <p className="mt-4 max-w-xl text-lg text-slate-400">{m.lead}</p>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <a href="#pricing" className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 px-6 py-3 font-bold text-white shadow-lg shadow-indigo-500/30">
                            {m.cta1}
                        </a>
                        <a href="#features" className="rounded-xl border border-[#22294a] px-6 py-3 font-bold text-slate-100 hover:bg-[#131a30]">
                            {m.cta2}
                        </a>
                    </div>
                    <p className="mt-4 text-sm text-slate-500">{m.nocard}</p>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/landing/dashboard.svg"
                    alt=""
                    aria-hidden="true"
                    width={560}
                    height={400}
                    className="w-full rounded-2xl shadow-[0_30px_60px_-30px_rgba(99,102,241,.55)]"
                />
            </div>
        </header>
    );
}
