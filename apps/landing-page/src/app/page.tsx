const ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'digima.cloud';

type Vertical = {
  name: string;
  subdomain: string;
  description: string;
  icon: string;
  live: boolean;
};

const verticals: Vertical[] = [
  {
    name: 'Tourisme',
    subdomain: 'tourism',
    description: 'Hôtels, activités, restaurants et réservations.',
    icon: '🏖️',
    live: true,
  },
  {
    name: 'Santé',
    subdomain: 'sante',
    description: 'Médecins, cliniques et prise de rendez-vous.',
    icon: '🩺',
    live: false,
  },
  {
    name: 'Éducation',
    subdomain: 'education',
    description: 'Écoles, formations et ressources pédagogiques.',
    icon: '🎓',
    live: false,
  },
  {
    name: 'Services',
    subdomain: 'services',
    description: 'Services publics et démarches administratives.',
    icon: '🏛️',
    live: false,
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center px-6 py-20">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Moro<span className="text-primary-500">SmartCity</span>
        </h1>
        <p className="mt-4 max-w-xl text-slate-400">
          L&apos;écosystème digital qui connecte tourisme, santé, éducation
          et services publics au Maroc.
        </p>
      </header>

      <section className="mt-16 grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
        {verticals.map((v) => (
          <a
            key={v.subdomain}
            href={
              v.live
                ? `https://${v.subdomain}.${ROOT_DOMAIN}`
                : undefined
            }
            aria-disabled={!v.live}
            className={`group relative flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition ${
              v.live
                ? 'hover:border-primary-500 hover:bg-slate-900'
                : 'cursor-not-allowed opacity-50'
            }`}
          >
            <span className="text-3xl">{v.icon}</span>
            <h2 className="text-xl font-semibold">{v.name}</h2>
            <p className="text-sm text-slate-400">{v.description}</p>
            <span className="mt-2 text-xs font-medium text-slate-500">
              {v.subdomain}.{ROOT_DOMAIN}
              {!v.live && ' — bientôt disponible'}
            </span>
          </a>
        ))}
      </section>

      <footer className="mt-20 text-xs text-slate-600">
        © {new Date().getFullYear()} MoroSmartCity
      </footer>
    </main>
  );
}
