import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
    return (
        <div
            className={`rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none ${className}`}
        >
            {children}
        </div>
    );
}

export function SectionTitle({ icon: Icon, children, action }: { icon?: LucideIcon; children: ReactNode; action?: ReactNode }) {
    return (
        <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {Icon && <Icon className="h-4 w-4 text-indigo-500" aria-hidden />}
                {children}
            </h2>
            {action}
        </div>
    );
}

export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
    return (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Icon className="h-6 w-6 text-slate-400" aria-hidden />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
            {hint && <p className="text-xs text-slate-400">{hint}</p>}
        </div>
    );
}

/** Numbers, phones, amounts and dates keep a left-to-right order inside Arabic text. */
export function Ltr({ children, className = '' }: { children: ReactNode; className?: string }) {
    return (
        <bdi dir="ltr" className={`inline-block ${className}`}>
            {children}
        </bdi>
    );
}
