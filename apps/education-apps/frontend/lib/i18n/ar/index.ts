// Arabic dictionary, keyed by the French source text. One file per area; later files win on a duplicate key.
import { auth } from './auth';
import { shell } from './shell';

export const AR: Record<string, string> = { ...shell, ...auth };
