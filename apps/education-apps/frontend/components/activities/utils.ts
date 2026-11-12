export const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** An activity is "past" once its end (or start) is behind us. */
export const isPast = (a: { startAt: string; endAt: string | null }, now = Date.now()) => new Date(a.endAt ?? a.startAt).getTime() < now;
