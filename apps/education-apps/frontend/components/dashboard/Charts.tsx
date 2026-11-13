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

// Bright series tones of the "Vibrant" theme (school staff dashboards). Same values in light and dark.
export const VIBRANT_TONES = [
    { fill: 'fill-[#4F46E5]', stroke: 'stroke-[#4F46E5]', bg: 'bg-[#4F46E5]' },
    { fill: 'fill-[#059669]', stroke: 'stroke-[#059669]', bg: 'bg-[#059669]' },
    { fill: 'fill-[#D97706]', stroke: 'stroke-[#D97706]', bg: 'bg-[#D97706]' },
    { fill: 'fill-[#DB2777]', stroke: 'stroke-[#DB2777]', bg: 'bg-[#DB2777]' },
    { fill: 'fill-[#7C3AED]', stroke: 'stroke-[#7C3AED]', bg: 'bg-[#7C3AED]' },
    { fill: 'fill-[#0E7490]', stroke: 'stroke-[#0E7490]', bg: 'bg-[#0E7490]' },
] as const;

export type ChartPalette = 'espresso' | 'vibrant';

// Per-palette classes; 'espresso' keeps the agent / platform dashboards exactly as they were.
const PAL = {
    espresso: {
        tones: TONES as readonly { fill: string; stroke: string; bg: string }[],
        card: 'rounded-xl border border-espresso-100 bg-white shadow-sm dark:border-espresso-800 dark:bg-espresso-900 dark:shadow-none p-3',
        title: 'text-center text-sm font-bold leading-tight text-espresso-800 dark:text-espresso-100',
        hint: 'mt-0.5 text-center text-[11px] text-gray-500 dark:text-espresso-300',
        muted: 'text-gray-500 dark:text-espresso-300',
        strong: 'text-gray-700 dark:text-espresso-100',
        label: 'text-espresso-700 dark:text-espresso-200',
        bar: 'bg-espresso-600 dark:bg-espresso-400',
        axisBorder: 'border-espresso-100 dark:border-espresso-800',
        grid: 'stroke-gray-100 dark:stroke-espresso-800',
        axis: 'stroke-gray-300 dark:stroke-espresso-700',
        area: 'fill-gray-200/70 dark:fill-espresso-700/40',
        line: 'stroke-espresso-700 dark:stroke-espresso-300',
        selRect: 'fill-espresso-100/70 dark:fill-espresso-800/70',
        dotSel: 'fill-espresso-700 stroke-espresso-700 dark:fill-espresso-200 dark:stroke-espresso-200',
        dot: 'fill-white stroke-espresso-700 dark:fill-espresso-900 dark:stroke-espresso-300',
        svgStrong: 'fill-espresso-900 dark:fill-espresso-50',
        svgMuted: 'fill-gray-600 dark:fill-espresso-200',
        svgFaint: 'fill-gray-500 dark:fill-espresso-300',
    },
    vibrant: {
        tones: VIBRANT_TONES as readonly { fill: string; stroke: string; bg: string }[],
        card: 'rounded-3xl bg-white shadow-sm dark:bg-vib-card dark:border dark:border-white/5 dark:shadow-none p-5',
        title: 'text-sm font-bold leading-tight text-gray-900 dark:text-white',
        hint: 'mt-0.5 text-xs text-gray-500 dark:text-gray-400',
        muted: 'text-gray-500 dark:text-gray-400',
        strong: 'text-gray-700 dark:text-gray-100',
        label: 'text-gray-600 dark:text-gray-300',
        bar: 'bg-[#4F46E5] dark:bg-[#818CF8]',
        axisBorder: 'border-gray-100 dark:border-white/10',
        grid: 'stroke-gray-100 dark:stroke-white/5',
        axis: 'stroke-gray-200 dark:stroke-white/10',
        area: 'fill-[#4F46E5]/10 dark:fill-[#818CF8]/15',
        line: 'stroke-[#4F46E5] dark:stroke-[#818CF8]',
        selRect: 'fill-[#4F46E5]/10',
        dotSel: 'fill-[#4F46E5] stroke-[#4F46E5]',
        dot: 'fill-white stroke-[#4F46E5] dark:fill-vib-card dark:stroke-[#818CF8]',
        svgStrong: 'fill-gray-900 dark:fill-white',
        svgMuted: 'fill-gray-500 dark:fill-gray-400',
        svgFaint: 'fill-gray-500 dark:fill-gray-400',
    },
};

export const cardClass =
    'rounded-xl border border-espresso-100 bg-white shadow-sm dark:border-espresso-800 dark:bg-espresso-900 dark:shadow-none';

export function ChartCard({ title, hint, children, className = '', palette = 'espresso' }: { title: string; hint?: string; children: React.ReactNode; className?: string; palette?: ChartPalette }) {
    const P = PAL[palette];
    return (
        <section className={`${P.card} ${className}`}>
            <h3 className={P.title}>{title}</h3>
            {hint && <p className={P.hint}>{hint}</p>}
            <div className="mt-2">{children}</div>
        </section>
    );
}

export function EmptyChart({ text, palette = 'espresso' }: { text: string; palette?: ChartPalette }) {
    return <p className={`py-6 text-center text-xs ${PAL[palette].muted}`}>{text}</p>;
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

export function VBarChart({ data, format, empty, palette = 'espresso' }: { data: BarDatum[]; format: (v: number) => string; empty: string; palette?: ChartPalette }) {
    const P = PAL[palette];
    const max = Math.max(0, ...data.map((d) => d.value));
    if (data.length === 0 || max === 0) return <EmptyChart text={empty} palette={palette} />;
    return (
        <div className="overflow-x-auto">
            <div className="flex min-w-full gap-1.5" style={{ minWidth: `${data.length * 40}px` }}>
                {data.map((d) => (
                    <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center">
                        <div className="flex h-24 w-full flex-col items-center justify-end">
                            <span className={`mb-0.5 text-[10px] font-bold tabular-nums ${P.strong}`}>{format(d.value)}</span>
                            <span
                                className={`w-full max-w-[32px] rounded-t-md ${P.bar}`}
                                style={{ height: `${(d.value / max) * 82}%`, minHeight: d.value > 0 ? 3 : 0 }}
                                title={`${d.label} : ${format(d.value)}`}
                            />
                        </div>
                        <span className={`mt-1 w-full border-t pt-0.5 text-center text-[10px] font-semibold leading-tight line-clamp-2 ${P.axisBorder} ${P.label}`} title={d.label}>
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
    palette?: ChartPalette;
}

export function SplineChart({ points, rtl, format, formatShort, selectedKey, onSelect, selectLabel, palette = 'espresso' }: LineProps) {
    const P = PAL[palette];
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
                    <line key={f} x1={padX - 14} x2={W - padX + 14} y1={base - f * (base - top)} y2={base - f * (base - top)} className={P.grid} strokeWidth={1} />
                ))}
                <line x1={padX - 14} x2={W - padX + 14} y1={base} y2={base} className={P.axis} strokeWidth={1} />
                <path d={area} className={P.area} />
                <path d={line} fill="none" className={P.line} strokeWidth={palette === 'vibrant' ? 2.5 : 2} strokeLinecap="round" />
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
                            {selected && <rect x={p.x - 15} y={top - 18} width={30} height={base - top + 18} rx={6} className={P.selRect} />}
                            <circle className="ring" cx={p.x} cy={p.y} r={8} fill="none" strokeWidth={2} stroke="transparent" />
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r={selected ? 5 : 3.5}
                                strokeWidth={2}
                                className={selected ? P.dotSel : P.dot}
                            />
                            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={10} fontWeight={700} className={P.svgStrong}>
                                {formatShort(p.value)}
                            </text>
                            <text x={p.x} y={base + 14} textAnchor="middle" fontSize={10} fontWeight={600} className={P.svgMuted}>
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
    palette?: ChartPalette;
}

export function DonutChart({ data, totalLabel, formatValue, formatTotal = formatValue, formatPct, empty, palette = 'espresso' }: DonutProps) {
    const P = PAL[palette];
    const tones = P.tones;
    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return <EmptyChart text={empty} palette={palette} />;
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
                            className={tones[s.tone % tones.length].stroke}
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
                        <text key={s.key} x={lx} y={ly + 4} textAnchor={anchor} fontSize={10} fontWeight={700} className={P.svgStrong} direction="ltr">
                            {`${formatValue(s.value)} (${formatPct(s.pct)})`}
                        </text>
                    );
                })}
                <text x={cx} y={cy + 2} textAnchor="middle" fontSize={formatTotal(total).length > 8 ? 11 : 16} fontWeight={800} className={P.svgStrong}>
                    {formatTotal(total)}
                </text>
                <text x={cx} y={cy + 13} textAnchor="middle" fontSize={9} className={P.svgFaint}>
                    {totalLabel}
                </text>
            </svg>
            <ul className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[11px]">
                {data.map((d) => (
                    <li key={d.key} className={`flex items-center gap-1.5 ${P.strong}`}>
                        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${tones[d.tone % tones.length].bg}`} />
                        {d.label}
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ---- Vibrant KPI card (solid fill, white text) -----------------------------------------------------------------

export const VIBRANT_KPI_FILLS = {
    indigo: 'bg-[#4F46E5]',
    emerald: 'bg-[#047857]',
    amber: 'bg-[#B45309]',
    pink: 'bg-[#BE185D]',
    violet: 'bg-[#6D28D9]',
    cyan: 'bg-[#0E7490]',
} as const;

export function VibrantKpi({
    label,
    value,
    sub,
    icon,
    tone,
    onClick,
}: {
    label: string;
    value: string;
    sub?: string;
    icon?: React.ReactNode;
    tone: keyof typeof VIBRANT_KPI_FILLS;
    onClick?: () => void;
}) {
    const body = (
        <>
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white/90">{label}</span>
                {icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/15" aria-hidden="true">{icon}</span>}
            </div>
            <div className="mt-3 text-[28px] font-extrabold leading-none tabular-nums sm:text-[32px]">{value}</div>
            {sub && <span className="mt-3 inline-block rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold">{sub}</span>}
        </>
    );
    const base = `${VIBRANT_KPI_FILLS[tone]} block w-full rounded-3xl p-5 text-left text-white shadow-sm`;
    if (!onClick) return <div className={base}>{body}</div>;
    return (
        <button type="button" onClick={onClick} className={`${base} transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50`}>
            {body}
        </button>
    );
}
