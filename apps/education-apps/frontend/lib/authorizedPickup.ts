import type { AuthorizedPickup } from '@/types';

/** One display line for an authorized pickup entry: the school mode stores text lines, older crèche data stores objects. */
export const pickupLine = (p: AuthorizedPickup): string =>
    typeof p === 'string' ? p : [p?.name, p?.relation ? `(${p.relation})` : '', p?.phone ? `— ${p.phone}` : ''].filter(Boolean).join(' ');
