// Arabic dictionary, keyed by the French source text. One file per area; later files win on a duplicate key.
import { auth } from './auth';
import { finance } from './finance';
import { pedagogy } from './pedagogy';
import { school } from './school';
import { schoolMode } from './school-mode';
import { settings } from './settings';
import { shell } from './shell';

export const AR: Record<string, string> = { ...shell, ...auth, ...school, ...settings, ...finance, ...pedagogy, ...schoolMode };
