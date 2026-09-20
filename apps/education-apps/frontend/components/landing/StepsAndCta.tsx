import type { Messages } from '@/lib/landing/messages';

export default function StepsAndCta({ m }: { m: Messages }) {
    const steps = [
        { title: m.st1t, text: m.st1d },
        { title: m.st2t, text: m.st2d },
        { title: m.st3t, text: m.st3d },
    ];

    return (
        <>
            <section className="mx-auto max-w-6xl px-5 py-16">
                <h2 className="mb-8 text-center text-3xl font-extrabold">{m.h_title}</h2>
                <div className="grid gap-6 md:grid-cols-3">
                    {steps.map((step, index) => (
                        <div key={step.title} className="text-center">
                            <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-indigo-500 font-bold text-white">
                                {index + 1}
                            </span>
                            <h3 className="font-bold">{step.title}</h3>
                            <p className="text-sm text-slate-400">{step.text}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-5 pb-16">
                <div className="rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-500 p-10 text-center">
                    <h2 className="text-3xl font-extrabold text-white">{m.fin_t}</h2>
                    <p className="mt-2 text-indigo-100">{m.fin_d}</p>
                    <a href="#pricing" className="mt-5 inline-block rounded-xl bg-white px-6 py-3 font-bold text-indigo-600">
                        {m.cta1}
                    </a>
                </div>
            </section>

            <footer className="py-8 text-center text-sm text-slate-500">© Smart School</footer>
        </>
    );
}
