'use client';

// Small building blocks shared by the espresso dashboards (sales agent, super admin platform).

// ---- table styles
export const theadClass = 'sticky top-0 z-10 bg-espresso-800 text-espresso-50 text-xs dark:bg-espresso-ink';
export const thClass = 'px-3 py-2 font-semibold whitespace-nowrap text-start';
export const tdClass = 'px-3 py-2';
export const rowClass =
    'border-t border-espresso-100 odd:bg-white even:bg-espresso-50/60 hover:bg-espresso-100/60 dark:border-espresso-800 dark:odd:bg-espresso-900 dark:even:bg-espresso-950/50 dark:hover:bg-espresso-800/60';
// Phone layout (below md): each row becomes a card in a <ul className={cardListClass}>, the table is hidden.
export const cardListClass = 'divide-y divide-espresso-100 md:hidden dark:divide-espresso-800';
export const cardItemClass = 'space-y-1.5 px-3 py-3 text-sm text-gray-800 odd:bg-white even:bg-espresso-50/60 dark:text-espresso-100 dark:odd:bg-espresso-900 dark:even:bg-espresso-950/50';
export const cardEmptyClass = 'px-3 py-6 text-sm text-gray-500 md:hidden dark:text-espresso-300';
export const mutedClass = 'text-xs text-gray-500 dark:text-espresso-300';
export const emptyRowClass = 'px-3 py-6 text-gray-500 dark:text-espresso-300';

// ---- filter select on the dark brown filter bar
export function Slicer({
    id,
    label,
    value,
    onChange,
    options,
    all,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    all: string;
}) {
    return (
        <label htmlFor={id} className="block min-w-0">
            <span className="mb-1 block truncate text-xs font-bold text-espresso-50">{label}</span>
            <select
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full min-h-10 rounded-lg border border-transparent bg-white px-2 py-2 text-sm font-semibold text-espresso-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-espresso-300 dark:border-espresso-700 dark:bg-espresso-900 dark:text-espresso-50"
            >
                <option value="">{all}</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

// ---- tab buttons above the tables
export function TabButton({ id, selected, controls, onClick, children }: { id: string; selected: boolean; controls: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            role="tab"
            id={id}
            aria-selected={selected}
            aria-controls={controls}
            onClick={onClick}
            className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-espresso-500 ${
                selected
                    ? 'bg-espresso-800 text-white dark:bg-espresso-200 dark:text-espresso-950'
                    : 'border border-espresso-100 bg-white text-espresso-700 hover:bg-espresso-50 dark:border-espresso-800 dark:bg-espresso-900 dark:text-espresso-200 dark:hover:bg-espresso-800'
            }`}
        >
            {children}
        </button>
    );
}
