import type { LucideIcon } from 'lucide-react';

const colorClasses = {
  sky: 'bg-sky-50 text-sky-600',
  primary: 'bg-primary-50 text-primary-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  rose: 'bg-rose-50 text-rose-600',
  green: 'bg-green-50 text-green-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  teal: 'bg-teal-50 text-teal-600',
} as const;

export type StatCardColor = keyof typeof colorClasses;

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  color: StatCardColor;
}

export function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${colorClasses[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}
