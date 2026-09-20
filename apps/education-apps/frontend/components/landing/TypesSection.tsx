import type { Messages } from '@/lib/landing/messages';
import type { InstitutionType } from '@/lib/institutionTypes';

type Key = keyof Messages;

// `type: null` = school networks: not a type of its own, it only scrolls to pricing.
const TYPES: { icon: string; title: Key; type: InstitutionType | null; tags: Key[] }[] = [
    { icon: '🏫', title: 'ty1', type: 'PRIVATE_SCHOOL', tags: ['tg_enrol', 'tg_parents', 'tg_transport'] },
    { icon: '📝', title: 'ty2', type: 'TUTORING_CENTER', tags: ['tg_groups', 'tg_qr', 'tg_monthly'] },
    { icon: '🛠️', title: 'ty3', type: 'VOCATIONAL_TRAINING', tags: ['tg_formations', 'tg_docs', 'tg_monthly'] },
    { icon: '🗣️', title: 'ty4', type: 'LANGUAGE_CENTER', tags: ['tg_groups', 'tg_student', 'tg_monthly'] },
    { icon: '🧸', title: 'ty5', type: 'CRECHE', tags: ['tg_parents', 'tg_qr', 'tg_transport'] },
    { icon: '🏢', title: 'ty6', type: null, tags: ['tg_sites', 'tg_owner', 'tg_finance'] },
];

interface Props {
    m: Messages;
    onPick: (type: InstitutionType | null) => void;
}

export default function TypesSection({ m, onPick }: Props) {
    return (
        <section className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-center text-3xl font-extrabold">{m.t_title}</h2>
            <p className="mb-8 mt-2 text-center text-slate-400">{m.t_sub}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {TYPES.map((item) => (
                    <button
                        key={item.title}
                        type="button"
                        onClick={() => onPick(item.type)}
                        className="rounded-2xl border border-[#22294a] bg-[#131a30] p-5 text-start transition hover:border-indigo-400"
                    >
                        <div className="text-3xl">{item.icon}</div>
                        <h3 className="mb-3 mt-2 text-base font-bold">{m[item.title]}</h3>
                        <div className="flex flex-wrap gap-1.5">
                            {item.tags.map((tag) => (
                                <span key={tag} className="rounded-full bg-indigo-400/15 px-2.5 py-1 text-xs font-semibold text-indigo-300">
                                    {m[tag]}
                                </span>
                            ))}
                        </div>
                    </button>
                ))}
            </div>
        </section>
    );
}
