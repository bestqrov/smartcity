'use client';

// Small dependency-free charts (HTML bars + inline SVG) for the espresso dashboards (sales agent, super admin).
// They follow the document direction: bars grow from the inline start, time axes run right-to-left in Arabic.
import { ArrowDown, ArrowUp } from 'lucide-react';

// Series tones of the espresso palette, light / dark. Literal strings so Tailwind keeps them.
export const TONES = [
    { fill: 'fill-espresso-800 dark:fill-espresso-200', stroke: 'stroke-espresso-800 dark:stroke-espresso-200', bg: 'bg-espresso-800 dark:bg-espresso-200' },
    { fill: 'fill-espresso-400 dark:fill-espresso-400', stroke: 'stroke-espresso-400 dark:stroke-espresso-400', bg: 'bg-espresso-400 dark:bg-espresso-400' },
    { fill: 'fill-steel dark:fill-steel-light', stroke: 'stroke-steel dark:stroke-steel-light', bg: 'bg-steel dark:bg-steel-light' },
    { fill: 'fill-charcoal dark:fill-espresso-500', stroke: 'stroke-charcoal dark:stroke-espresso-500', bg: 'bg-charcoal dark:bg-espresso-500' },
    { fill: 'fill-espresso-600 dark:fill-espresso-300', stroke: 'stroke-espresso-600 dark:stroke-espresso-300', bg: 'bg-espresso-600 dark:bg-espresso-300' },
] as const;

export const cardClass =
    'rounded-xl border border-espresso-100 bg-white shadow-sm dark:border-espresso-800 dark:bg-espresso-900 dark:shadow-none';

export function ChartCard({ title, hint, children, className = '' }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
    return (
        <section className={`${cardClass} p-3 ${className}`}>
            <h3 className="text-center text-sm font-bold leading-tight text-espresso-800 dark:text-espresso-100">{title}</h3>
            {hint && <p className="mt-0.5 text-center text-[11px] text-gray-500 dark:text-espresso-300">{hint}</p>}
            <div className="mt-2">{children}</div>
        </section>
    );
}

export function EmptyChart({ text }: { text: string }) {
    return <p className="py-6 text-center text-xs text-gray-500 dark:text-espresso-300">{text}</p>;
}

// ---- KPI card --------------------------------------------------------------------------------------------------

interface KpiProps {
    label: string;
    value: string;
    sub?: string;
    delta?: { value: number; text: string; label: string } | null; // value > 0 shows ▲ in green
    onClick?: () => void;
    expanded?: boolean;
    highlight?: boolean;
}

export function KpiCard({ label, value, sub, delta, onClick, expanded, highlight }: KpiProps) {
    const body = (
        <>
            <span aria-hidden="true" className={`absolute inset-y-0 start-0 w-1.5 ${highlight ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-espresso-800 dark:bg-espresso-400'}`} />
            <div className="text-lg font-extrabold tabular-nums leading-tight text-espresso-900 dark:text-espresso-50 sm:text-xl">{value}</div>
            <div className="mt-1 text-xs font-bold text-espresso-700 dark:text-espresso-200 sm:text-sm">{label}</div>
            {delta && (
                <div
                    className={`mt-1 inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
                        delta.value > 0 ? 'text-emerald-700 dark:text-emerald-400' : delta.value < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-espresso-300'
                    }`}
                    title={delta.label}
                >
                    {delta.value > 0 && <ArrowUp size={12} aria-hidden="true" />}
                    {delta.value < 0 && <ArrowDown size={12} aria-hidden="true" />}
                    <span>{delta.text}</span>
                    <span className="sr-only">{delta.label}</span>
                </div>
            )}
            {sub && <div className="mt-0.5 text-[11px] text-gray-500 dark:text-espresso-300">{sub}</div>}
        </>
    );
    const base = `${cardClass} relative overflow-hidden ps-4 pe-2 py-2 text-center`;
    if (!onClick) return <div className={base}>{body}</div>;
    return (
        <button
            type="button"
            onClick={onClick}
            aria-expanded={expanded}
            className={`${base} w-full transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-espresso-500 dark:hover:border-espresso-600`}
        >
            {body}
        </button>
    );
}

// ---- horizontal bars (HTML, direction-aware) ---------------------------------------------------------------

export interface BarDatum {
    key: string;
    label: string;
    value: number;
    icon?: React.ReactNode; // e.g. an avatar, shown before the label (horizontal bars only)
}

export function HBarChart({ data: all, format, empty, maxRows = 6 }: { data: BarDatum[]; format: (v: number) => string; empty: string; maxRows?: number }) {
    // Long lists keep only the top rows by value.
    const data = all.length > maxRows ? [...all].sort((a, b) => b.value - a.value).slice(0, maxRows) : all;
    const max = Math.max(0, ...data.map((d) => d.value));
    if (data.length === 0 || max === 0) return <EmptyChart text={empty} />;
    return (
        <ul className="space-y-1.5">
            {data.map((d) => (
                <li key={d.key} className="flex items-center gap-2 text-[11px]">
                    {d.icon ? (
                        <span className="flex w-28 shrink-0 items-center justify-end gap-1.5 sm:w-32" title={d.label}>
                            <span className="min-w-0 truncate text-end font-semibold text-espresso-800 dark:text-espresso-100">{d.label}</span>
                            {d.icon}
                        </span>
                    ) : (
                        <span className="w-24 shrink-0 truncate text-end font-semibold text-espresso-800 dark:text-espresso-100 sm:w-28" title={d.label}>
                            {d.label}
                        </span>
                    )}
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span
                            className="h-3.5 shrink-0 rounded-e-md bg-espresso-600 dark:bg-espresso-400"
                            style={{ width: `${Math.max(d.value > 0 ? 2 : 0, (d.value / max) * 75)}%` }}
                            title={`${d.label} : ${format(d.value)}`}
                        />
                        <span className="whitespace-nowrap font-semibold tabular-nums text-gray-700 dark:text-espresso-100">{format(d.value)}</span>
                    </span>
                </li>
            ))}
        </ul>
    );
}

// ---- vertical bars (HTML, direction-aware) -----------------------------------------------------------------

export function VBarChart({ data, format, empty }: { data: BarDatum[]; format: (v: number) => string; empty: string }) {
    const max = Math.max(0, ...data.map((d) => d.value));
    if (data.length === 0 || max === 0) return <EmptyChart text={empty} />;
    return (
        <div className="overflow-x-auto">
            <div className="flex min-w-full gap-1.5" style={{ minWidth: `${data.length * 40}px` }}>
                {data.map((d) => (
                    <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center">
                        <div className="flex h-24 w-full flex-col items-center justify-end">
                            <span className="mb-0.5 text-[10px] font-bold tabular-nums text-gray-700 dark:text-espresso-100">{format(d.value)}</span>
                            <span
                                className="w-full max-w-[32px] rounded-t-md bg-espresso-600 dark:bg-espresso-400"
                                style={{ height: `${(d.value / max) * 82}%`, minHeight: d.value > 0 ? 3 : 0 }}
                                title={`${d.label} : ${format(d.value)}`}
                            />
                        </div>
                        <span className="mt-1 w-full border-t border-espresso-100 pt-0.5 text-center text-[10px] font-semibold leading-tight text-espresso-700 line-clamp-2 dark:border-espresso-800 dark:text-espresso-200" title={d.label}>
                            {d.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---- smooth line with area (SVG) ---------------------------------------------------------------------------

interface LinePoint {
    key: string;
    label: string; // axis label (short month)
    title: string; // full label (month + year)
    value: number;
}

interface LineProps {
    points: LinePoint[];
    rtl: boolean;
    format: (v: number) => string; // full value, in tooltips
    formatShort: (v: number) => string; // point labels
    selectedKey?: string;
    onSelect?: (key: string) => void;
    selectLabel?: (title: string) => string;
}

export function SplineChart({ points, rtl, format, formatShort, selectedKey, onSelect, selectLabel }: LineProps) {
    const W = 480;
    const H = 140;
    const padX = 24;
    const top = 24;
    const base = H - 22;
    const max = Math.max(1, ...points.map((p) => p.value));
    const n = points.length;
    const xy = points.map((p, i) => {
        const ltrX = n === 1 ? W / 2 : padX + (i * (W - 2 * padX)) / (n - 1);
        return { ...p, x: rtl ? W - ltrX : ltrX, y: base - (p.value / max) * (base - top) };
    });

    // Catmull-Rom to cubic Bézier, control points clamped to the plot so the curve never dips below zero.
    const clampY = (y: number) => Math.min(base, Math.max(top - 10, y));
    let line = xy.length ? `M ${xy[0].x} ${xy[0].y}` : '';
    for (let i = 0; i < xy.length - 1; i++) {
        const p0 = xy[i - 1] ?? xy[i];
        const p1 = xy[i];
        const p2 = xy[i + 1];
        const p3 = xy[i + 2] ?? p2;
        const c1x = p1.x + (p2.x - p0.x) / 6;
        const c1y = clampY(p1.y + (p2.y - p0.y) / 6);
        const c2x = p2.x - (p3.x - p1.x) / 6;
        const c2y = clampY(p2.y - (p3.y - p1.y) / 6);
        line += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    const area = xy.length ? `${line} L ${xy[xy.length - 1].x} ${base} L ${xy[0].x} ${base} Z` : '';

    return (
        <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto max-h-[180px] w-full min-w-[300px]" role="img">
                {[0.25, 0.5, 0.75, 1].map((f) => (
                    <line key={f} x1={padX - 14} x2={W - padX + 14} y1={base - f * (base - top)} y2={base - f * (base - top)} className="stroke-gray-100 dark:stroke-espresso-800" strokeWidth={1} />
                ))}
                <line x1={padX - 14} x2={W - padX + 14} y1={base} y2={base} className="stroke-gray-300 dark:stroke-espresso-700" strokeWidth={1} />
                <path d={area} className="fill-gray-200/70 dark:fill-espresso-700/40" />
                <path d={line} fill="none" className="stroke-espresso-700 dark:stroke-espresso-300" strokeWidth={2} strokeLinecap="round" />
                {xy.map((p) => {
                    const selected = p.key === selectedKey;
                    return (
                        <g
                            key={p.key}
                            role={onSelect ? 'button' : undefined}
                            tabIndex={onSelect ? 0 : undefined}
                            aria-label={onSelect && selectLabel ? `${selectLabel(p.title)} — ${format(p.value)}` : undefined}
                            aria-pressed={onSelect ? selected : undefined}
                            onClick={onSelect ? () => onSelect(p.key) : undefined}
                            onKeyDown={
                                onSelect
                                    ? (e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              onSelect(p.key);
                                          }
                                      }
                                    : undefined
                            }
                            className={`${onSelect ? 'cursor-pointer' : ''} outline-none [&:focus-visible>circle.ring]:stroke-espresso-500`}
                        >
                            <title>{`${p.title} : ${format(p.value)}`}</title>
                            <rect x={p.x - 16} y={top - 20} width={32} height={base - top + 40} fill="transparent" />
                            {selected && <rect x={p.x - 15} y={top - 18} width={30} height={base - top + 18} rx={6} className="fill-espresso-100/70 dark:fill-espresso-800/70" />}
                            <circle className="ring" cx={p.x} cy={p.y} r={8} fill="none" strokeWidth={2} stroke="transparent" />
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r={selected ? 5 : 3.5}
                                strokeWidth={2}
                                className={selected ? 'fill-espresso-700 stroke-espresso-700 dark:fill-espresso-200 dark:stroke-espresso-200' : 'fill-white stroke-espresso-700 dark:fill-espresso-900 dark:stroke-espresso-300'}
                            />
                            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={10} fontWeight={700} className="fill-espresso-900 dark:fill-espresso-50">
                                {formatShort(p.value)}
                            </text>
                            <text x={p.x} y={base + 14} textAnchor="middle" fontSize={10} fontWeight={600} className="fill-gray-600 dark:fill-espresso-200">
                                {p.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

// ---- donut with outside labels (SVG) + legend (HTML) ---------------------------------------------------------

export interface DonutDatum {
    key: string;
    label: string;
    value: number;
    tone: number; // index in TONES
}

interface DonutProps {
    data: DonutDatum[];
    totalLabel: string;
    formatValue: (v: number) => string; // segment value, e.g. a count or an amount
    formatTotal?: (v: number) => string;
    formatPct: (pct: number) => string;
    empty: string;
}

export function DonutChart({ data, totalLabel, formatValue, formatTotal = formatValue, formatPct, empty }: DonutProps) {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return <EmptyChart text={empty} />;
    const cx = 160;
    const cy = 82;
    const r = 47;
    const C = 2 * Math.PI * r;
    let acc = 0;
    const segments = data
        .filter((d) => d.value > 0)
        .map((d) => {
            const start = acc;
            acc += d.value;
            const mid = ((start + d.value / 2) / total) * 2 * Math.PI - Math.PI / 2;
            return { ...d, start, mid, pct: Math.round((d.value / total) * 100) };
        });

    return (
        <div>
            <svg viewBox="0 0 320 164" className="mx-auto h-auto w-full max-w-[320px]" role="img" aria-label={`${totalLabel} ${formatTotal(total)}`}>
                <g transform={`rotate(-90 ${cx} ${cy})`}>
                    {segments.map((s) => (
                        <circle
                            key={s.key}
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill="none"
                            strokeWidth={20}
                            strokeDasharray={`${(s.value / total) * C} ${C}`}
                            strokeDashoffset={-(s.start / total) * C}
                            className={TONES[s.tone % TONES.length].stroke}
                        >
                            <title>{`${s.label} : ${formatValue(s.value)} (${formatPct(s.pct)})`}</title>
                        </circle>
                    ))}
                </g>
                {segments.map((s) => {
                    const lx = cx + (r + 20) * Math.cos(s.mid);
                    const ly = cy + (r + 20) * Math.sin(s.mid);
                    const cos = Math.cos(s.mid);
                    const anchor = cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle';
                    return (
                        <text key={s.key} x={lx} y={ly + 4} textAnchor={anchor} fontSize={10} fontWeight={700} className="fill-espresso-900 dark:fill-espresso-50" direction="ltr">
                            {`${formatValue(s.value)} (${formatPct(s.pct)})`}
                        </text>
                    );
                })}
                <text x={cx} y={cy + 2} textAnchor="middle" fontSize={formatTotal(total).length > 8 ? 11 : 16} fontWeight={800} className="fill-espresso-900 dark:fill-espresso-50">
                    {formatTotal(total)}
                </text>
                <text x={cx} y={cy + 13} textAnchor="middle" fontSize={9} className="fill-gray-500 dark:fill-espresso-300">
                    {totalLabel}
                </text>
            </svg>
            <ul className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[11px]">
                {data.map((d) => (
                    <li key={d.key} className="flex items-center gap-1.5 text-gray-700 dark:text-espresso-100">
                        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${TONES[d.tone % TONES.length].bg}`} />
                        {d.label}
                    </li>
                ))}
            </ul>
        </div>
    );
}
