import type { Messages } from '@/lib/landing/messages';

type Key = keyof Messages;

const FEATURES: { icon: string; title: Key; text: Key; soon?: boolean }[] = [
    { icon: '👨‍👩‍👧', title: 'f1t', text: 'f1d' },
    { icon: '🧑‍🎓', title: 'f9t', text: 'f9d' },
    { icon: '📷', title: 'f2t', text: 'f2d' },
    { icon: '🚌', title: 'f3t', text: 'f3d' },
    { icon: '💰', title: 'f4t', text: 'f4d' },
    { icon: '📚', title: 'f10t', text: 'f10d' },
    { icon: '👥', title: 'f11t', text: 'f11d' },
    { icon: '🏫', title: 'f5t', text: 'f5d' },
    { icon: '📢', title: 'f6t', text: 'f6d' },
    { icon: '🍽️', title: 'f8t', text: 'f8d', soon: true },
];

export default function FeaturesSection({ m }: { m: Messages }) {
    return (
        <section id="features" className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-center text-3xl font-extrabold">{m.f_title}</h2>
            <p className="mb-8 mt-2 text-center text-slate-400">{m.f_sub}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {FEATURES.map((feature) => (
                    <div key={feature.title} className="rounded-2xl border border-[#22294a] bg-[#131a30] p-5">
                        <div className="text-2xl">{feature.icon}</div>
                        <h3 className="mb-1 mt-2 text-base font-bold">
                            {m[feature.title]}
                            {feature.soon && (
                                <span className="ms-2 inline-block rounded-full bg-amber-400/20 px-2 py-0.5 align-middle text-[11px] font-bold text-amber-400">
                                    {m.soon}
                                </span>
                            )}
                        </h3>
                        <p className="text-sm text-slate-400">{m[feature.text]}</p>
                    </div>
                ))}
                <div className="flex items-center gap-4 rounded-2xl border border-indigo-400 bg-[#131a30] p-5 sm:col-span-2">
                    <div className="text-4xl">📍</div>
                    <div>
                        <h3 className="mb-1 text-base font-bold">{m.f7t}</h3>
                        <p className="text-sm text-slate-400">{m.f7d}</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
