/* eslint-disable @next/next/no-img-element */
// Round avatar for a sales agent: the photo when there is one, otherwise the initial.
export function AgentAvatar({ src, name, size, className = '' }: { src?: string | null; name?: string | null; size: number; className?: string }) {
    const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.42)) };
    if (src) return <img src={src} alt="" style={style} className={`shrink-0 rounded-full object-cover ${className}`} />;
    const initial = (name ?? '').trim().charAt(0).toUpperCase() || '?';
    return (
        <span aria-hidden="true" style={style} className={`flex shrink-0 select-none items-center justify-center rounded-full font-extrabold ${className}`}>
            {initial}
        </span>
    );
}
