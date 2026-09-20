# Education Packs + Institution Types — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SUPER_ADMIN pack screens, the institution-type-aware sidebar, the bilingual (Arabic MSA / French) dark "Smart School" landing page at `/` with type-first pricing, and the type/pack-aware signup page.

**Architecture:** Typed API services over the existing axios instance (`lib/api`), one shared constants module for institution types and pack features, a `applyInstitutionType` menu helper used by the Sidebar, and a landing page made of small section components driven by one typed messages file (`fr`/`ar` with identical keys) and by `GET /api/packs/public?type=…`.

**Tech Stack:** Next.js 14 (App Router, client components), React 18, Tailwind 3, axios, zustand, lucide-react. The frontend has **no test runner**: every task is verified with `npx tsc --noEmit` (0 errors at baseline) and the final task with `npx next build` plus manual QA.

**Spec:** `docs/superpowers/specs/2026-09-20-education-packs-landing-design.md` · **Depends on:** the backend plan `2026-09-20-education-packs-backend.md` (needed only for live QA; the code compiles without it). Visual reference: `docs/superpowers/specs/assets/2026-09-20-smart-school-landing-mockup.html` (dark style B).

**Conventions**
- Commands run from `apps/education-apps/frontend`. Use a branch `feature/education-packs-frontend` (or the same branch as the backend plan).
- Commit trailer, verbatim: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Existing admin pages use French UI text and Tailwind light cards (see `app/admin/vacances/page.tsx`); the landing is dark-only and bilingual.

## Decisions that refine the spec

1. The signup page already says "Smart School", so no brand change is needed there; it only gains type/pack selection.
2. `useSearchParams` in the signup page needs a `<Suspense>` boundary (Next 14 build requirement).
3. The dashboard illustration is a static SVG file (`public/landing/dashboard.svg`) with the dark palette hard-coded (an `<img>` cannot read CSS variables). It contains no words, only numbers and emoji.
4. The selected institution type on the landing is remembered in `localStorage` (try/catch), not the URL hash.
5. Sidebar wording/menus per type live in one file, `lib/institutionTypes.ts`; the crèche keeps the tutoring-menu group (it is where students live) but relabels it "Enfants" and hides Formations.

## File Structure

**Create:** `lib/institutionTypes.ts`, `lib/packs.ts`, `lib/services/packs.ts`, `app/admin/packs/page.tsx`, `lib/landing/messages.ts`, `lib/landing/useLandingLang.ts`, `lib/landing/whatsapp.ts`, `public/landing/dashboard.svg`, `components/landing/{LandingPage,LandingNav,Hero,FeaturesSection,TypesSection,PricingSection,StepsAndCta,WhatsAppButton}.tsx`.
**Modify:** `lib/services/schools.ts`, `hooks/useSchoolProfile.ts`, `components/Sidebar.tsx`, `app/admin/schools/page.tsx`, `app/page.tsx`, `app/signup/page.tsx`.

---

### Task 1: Shared constants, helper and API services

**Files:** Create `lib/institutionTypes.ts`, `lib/packs.ts`, `lib/services/packs.ts`; Modify `lib/services/schools.ts`

- [ ] **Step 1: Baseline** — run `npx tsc --noEmit` (expect 0 errors) and note it.

- [ ] **Step 2: `lib/institutionTypes.ts`**

```ts
export type InstitutionType =
    | 'PRIVATE_SCHOOL'
    | 'TUTORING_CENTER'
    | 'VOCATIONAL_TRAINING'
    | 'LANGUAGE_CENTER'
    | 'CRECHE';

export const INSTITUTION_TYPES: InstitutionType[] = [
    'PRIVATE_SCHOOL',
    'TUTORING_CENTER',
    'VOCATIONAL_TRAINING',
    'LANGUAGE_CENTER',
    'CRECHE',
];

export const DEFAULT_INSTITUTION_TYPE: InstitutionType = 'PRIVATE_SCHOOL';

export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
    PRIVATE_SCHOOL: 'École privée',
    TUTORING_CENTER: 'Centre de soutien scolaire',
    VOCATIONAL_TRAINING: 'Formation professionnelle',
    LANGUAGE_CENTER: 'Centre de langues',
    CRECHE: 'Crèche / maternelle',
};

export const isInstitutionType = (value: unknown): value is InstitutionType =>
    typeof value === 'string' && (INSTITUTION_TYPES as string[]).includes(value);

// ---- sidebar adaptation ------------------------------------------------------------------------

export interface MenuItemLike {
    id: string;
    label: string;
    submenu?: { label: string; path: string }[];
}

interface InstitutionTypeConfig {
    hiddenMenuIds: string[];
    // Menu ids shown right after the pinned entries, in this order.
    menuOrderFirst: string[];
    menuLabels: Record<string, string>;
    // Sub-menu labels keyed by their path.
    subLabels: Record<string, string>;
    // Entries shown but not clickable yet.
    comingSoon: { id: string; label: string }[];
}

const NONE: InstitutionTypeConfig = {
    hiddenMenuIds: [],
    menuOrderFirst: [],
    menuLabels: {},
    subLabels: {},
    comingSoon: [],
};

// Adding a type or changing its menu is a change to this one object.
export const INSTITUTION_TYPE_CONFIG: Record<InstitutionType, InstitutionTypeConfig> = {
    PRIVATE_SCHOOL: NONE,
    TUTORING_CENTER: NONE,
    LANGUAGE_CENTER: NONE,
    VOCATIONAL_TRAINING: { ...NONE, menuOrderFirst: ['formation'] },
    CRECHE: {
        hiddenMenuIds: ['formation'],
        menuOrderFirst: [],
        menuLabels: { soutien: 'Enfants' },
        subLabels: {
            '/admin/soutien-scolaire': 'État des enfants',
            '/admin/students': 'Enfants',
            '/admin/groups': 'Sections',
        },
        comingSoon: [{ id: 'daily-log', label: 'Journal quotidien' }],
    },
};

// Always shown first, in their original order (owner/super-admin entries and the dashboard).
const PINNED_IDS = ['branches', 'schools', 'packs', 'dashboard'];

export const getInstitutionTypeConfig = (type?: InstitutionType | null): InstitutionTypeConfig =>
    INSTITUTION_TYPE_CONFIG[type ?? DEFAULT_INSTITUTION_TYPE] ?? NONE;

export function applyInstitutionType<T extends MenuItemLike>(items: T[], type?: InstitutionType | null): T[] {
    const config = getInstitutionTypeConfig(type);

    const rank = (id: string): number => {
        if (PINNED_IDS.includes(id)) return -1;
        const index = config.menuOrderFirst.indexOf(id);
        return index === -1 ? config.menuOrderFirst.length : index;
    };

    return items
        .filter((item) => !config.hiddenMenuIds.includes(item.id))
        .map((item) => ({
            ...item,
            label: config.menuLabels[item.id] ?? item.label,
            submenu: item.submenu?.map((sub) => ({ ...sub, label: config.subLabels[sub.path] ?? sub.label })),
        }))
        .sort((a, b) => rank(a.id) - rank(b.id)); // Array.prototype.sort is stable
}
```

- [ ] **Step 3: `lib/packs.ts`**

```ts
export type PackFeature =
    | 'PARENT_PORTAL'
    | 'STUDENT_PORTAL'
    | 'QR_ATTENDANCE'
    | 'ANNOUNCEMENTS'
    | 'FINANCE_ANALYTICS'
    | 'TRANSPORT'
    | 'DAILY_LOG';

// Keep in sync with PACK_FEATURES in the backend (src/modules/packs/packs.constants.ts).
export const PACK_FEATURES: { key: PackFeature; label: string }[] = [
    { key: 'PARENT_PORTAL', label: 'Portail parents' },
    { key: 'STUDENT_PORTAL', label: 'Portail élève' },
    { key: 'QR_ATTENDANCE', label: 'Présence QR' },
    { key: 'ANNOUNCEMENTS', label: 'Annonces & vacances' },
    { key: 'FINANCE_ANALYTICS', label: 'Finance avancée' },
    { key: 'TRANSPORT', label: 'Transport scolaire' },
    { key: 'DAILY_LOG', label: 'Journal quotidien (crèche)' },
];
```

- [ ] **Step 4: `lib/services/packs.ts`**

```ts
import api from '../api';
import type { ApiResponse } from '@/types';
import type { InstitutionType } from '../institutionTypes';
import type { PackFeature } from '../packs';

export interface PublicPack {
    code: string;
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    maxStudents: number | null;
    maxBranches: number | null;
    features: PackFeature[];
    institutionTypes: InstitutionType[];
    recommended: boolean;
}

export interface AdminPack {
    id: string;
    name: string;
    code: string;
    monthlyPrice: number;
    yearlyPrice: number;
    maxStudents: number | null;
    maxBranches: number | null;
    features: PackFeature[];
    institutionTypes: InstitutionType[];
    isDefault: boolean;
    active: boolean;
    sortOrder: number;
    _count?: { schools: number };
}

export interface PackFormInput {
    name: string;
    code: string;
    monthlyPrice: number;
    yearlyPrice: number;
    maxStudents: number | null;
    maxBranches: number | null;
    features: PackFeature[];
    institutionTypes: InstitutionType[];
    active: boolean;
    sortOrder: number;
}

// The API puts the specific reason in `error`; `message` is only a generic label.
export const apiErrorMessage = (e: any): string =>
    e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Une erreur est survenue';

export async function fetchPublicPacks(type?: InstitutionType): Promise<PublicPack[]> {
    const response = await api.get<ApiResponse<PublicPack[]>>('/packs/public', {
        params: type ? { type } : undefined,
    });
    return response.data.data;
}

export async function getAllPacks(): Promise<AdminPack[]> {
    const response = await api.get<ApiResponse<AdminPack[]>>('/packs');
    return response.data.data;
}

export async function createPack(data: PackFormInput): Promise<AdminPack> {
    const response = await api.post<ApiResponse<AdminPack>>('/packs', data);
    return response.data.data;
}

export async function updatePack(id: string, data: Partial<PackFormInput>): Promise<AdminPack> {
    const response = await api.put<ApiResponse<AdminPack>>(`/packs/${id}`, data);
    return response.data.data;
}

export async function setDefaultPack(id: string): Promise<AdminPack> {
    const response = await api.patch<ApiResponse<AdminPack>>(`/packs/${id}/default`);
    return response.data.data;
}

export async function assignSchoolPack(schoolId: string, packId: string): Promise<void> {
    await api.patch(`/schools/${schoolId}/pack`, { packId });
}
```

- [ ] **Step 5: Extend `lib/services/schools.ts`.** Add at the top `import type { InstitutionType } from '../institutionTypes';`. Change `SignupSchoolData` to:

```ts
export interface SignupSchoolData {
    ownerName: string;
    ownerEmail: string;
    password: string;
    institutionType: InstitutionType;
    packCode?: string;
}
```

In `SchoolProfileData` add after `logo?: string | null;`:

```ts
    institutionType?: InstitutionType | null;
    pack?: {
        id: string;
        code: string;
        name: string;
        monthlyPrice: number;
        yearlyPrice: number;
        maxStudents: number | null;
        maxBranches: number | null;
        features: string[];
    } | null;
```

In `SchoolListItem` add after `createdAt: string;`:

```ts
    institutionType?: InstitutionType | null;
    packId?: string | null;
    pack?: { id: string; code: string; name: string } | null;
```

- [ ] **Step 6: Typecheck.** Run `npx tsc --noEmit`. Expected: an error in `app/signup/page.tsx` (`institutionType` missing from the initial form state) — that file is fixed in Task 7. To keep every commit compiling, temporarily make the field optional? **No:** instead change `useState<SignupSchoolData>({ ownerName: '', ownerEmail: '', password: '' })` in `app/signup/page.tsx` to `useState<SignupSchoolData>({ ownerName: '', ownerEmail: '', password: '', institutionType: 'PRIVATE_SCHOOL' })` now (Task 7 replaces this line). Re-run `npx tsc --noEmit` → 0 errors.

- [ ] **Step 7: Commit**

```bash
git add lib app/signup/page.tsx
git commit -m "feat(education): frontend constants, menu helper and services for packs and institution types

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Super Admin packs page and sidebar entry

**Files:** Create `app/admin/packs/page.tsx`; Modify `components/Sidebar.tsx`

- [ ] **Step 1: The page** `app/admin/packs/page.tsx` (same SUPER_ADMIN guard pattern as `app/admin/schools/page.tsx`):

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Plus, Star } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import { Modal } from '@/components/ui/Modal';
import { INSTITUTION_TYPES, INSTITUTION_TYPE_LABELS, type InstitutionType } from '@/lib/institutionTypes';
import { PACK_FEATURES, type PackFeature } from '@/lib/packs';
import {
    apiErrorMessage,
    createPack,
    getAllPacks,
    setDefaultPack,
    updatePack,
    type AdminPack,
    type PackFormInput,
} from '@/lib/services/packs';

interface FormState {
    name: string;
    code: string;
    monthlyPrice: string;
    yearlyPrice: string;
    maxStudents: string; // empty = unlimited
    maxBranches: string; // empty = unlimited
    sortOrder: string;
    features: PackFeature[];
    institutionTypes: InstitutionType[];
    active: boolean;
}

const emptyForm: FormState = {
    name: '',
    code: '',
    monthlyPrice: '',
    yearlyPrice: '',
    maxStudents: '',
    maxBranches: '',
    sortOrder: '0',
    features: [],
    institutionTypes: [],
    active: true,
};

const toForm = (pack: AdminPack): FormState => ({
    name: pack.name,
    code: pack.code,
    monthlyPrice: String(pack.monthlyPrice),
    yearlyPrice: String(pack.yearlyPrice),
    maxStudents: pack.maxStudents === null ? '' : String(pack.maxStudents),
    maxBranches: pack.maxBranches === null ? '' : String(pack.maxBranches),
    sortOrder: String(pack.sortOrder),
    features: pack.features,
    institutionTypes: pack.institutionTypes,
    active: pack.active,
});

const toInput = (form: FormState): PackFormInput => ({
    name: form.name,
    code: form.code,
    monthlyPrice: Number(form.monthlyPrice),
    yearlyPrice: Number(form.yearlyPrice),
    maxStudents: form.maxStudents.trim() === '' ? null : Number(form.maxStudents),
    maxBranches: form.maxBranches.trim() === '' ? null : Number(form.maxBranches),
    sortOrder: Number(form.sortOrder || 0),
    features: form.features,
    institutionTypes: form.institutionTypes,
    active: form.active,
});

const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

const inputCls =
    'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';
const labelCls = 'block text-xs font-medium text-gray-500 mb-1';

export default function SuperAdminPacksPage() {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const [packs, setPacks] = useState<AdminPack[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<AdminPack | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            setPacks(await getAllPacks());
        } catch (e) {
            setError(apiErrorMessage(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && user.role !== 'SUPER_ADMIN') {
            router.push('/admin');
            return;
        }
        if (user?.role === 'SUPER_ADMIN') load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, router]);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setError('');
        setModalOpen(true);
    };

    const openEdit = (pack: AdminPack) => {
        setEditing(pack);
        setForm(toForm(pack));
        setError('');
        setModalOpen(true);
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        setError('');
        try {
            const input = toInput(form);
            if (editing) await updatePack(editing.id, input);
            else await createPack(input);
            setModalOpen(false);
            await load();
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const runOn = async (id: string, action: () => Promise<unknown>) => {
        setBusyId(id);
        setError('');
        try {
            await action();
            await load();
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusyId(null);
        }
    };

    if (!user || user.role !== 'SUPER_ADMIN') return null;

    const limit = (value: number | null) => (value === null ? '∞' : value);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Packs</h1>
                    <p className="text-gray-600 mt-1">Catalogue des offres vendues aux établissements</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm"
                    >
                        <Plus size={16} /> Nouveau pack
                    </button>
                    <div className="bg-blue-100 p-3 rounded-lg">
                        <Package className="text-blue-600" size={32} />
                    </div>
                </div>
            </div>

            {error && !modalOpen && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">{error}</div>
            )}

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-x-auto">
                {loading ? (
                    <p className="p-8 text-gray-500">Chargement…</p>
                ) : packs.length === 0 ? (
                    <p className="p-8 text-gray-500">
                        Aucun pack. Exécutez <code>npm run prisma:seed-packs</code> ou créez-en un.
                    </p>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-600 text-sm uppercase">
                            <tr>
                                <th className="px-4 py-3">Pack</th>
                                <th className="px-4 py-3">Prix (MAD)</th>
                                <th className="px-4 py-3">Limites</th>
                                <th className="px-4 py-3">Types</th>
                                <th className="px-4 py-3">Fonctionnalités</th>
                                <th className="px-4 py-3">Écoles</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {packs.map((pack) => (
                                <tr key={pack.id} className="border-t border-gray-100 align-top text-sm">
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-gray-800 flex items-center gap-2">
                                            {pack.name}
                                            {pack.isDefault && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] font-bold">
                                                    <Star size={11} /> Par défaut
                                                </span>
                                            )}
                                            {!pack.active && (
                                                <span className="rounded-full bg-gray-200 text-gray-600 px-2 py-0.5 text-[11px] font-bold">
                                                    Inactif
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs text-gray-400">{pack.code}</p>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                        {pack.monthlyPrice} / mois
                                        <br />
                                        <span className="text-gray-400">{pack.yearlyPrice} / an</span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                        {limit(pack.maxStudents)} élèves
                                        <br />
                                        {limit(pack.maxBranches)} établissement(s)
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {pack.institutionTypes.map((type) => (
                                                <span key={type} className="rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[11px] font-semibold">
                                                    {INSTITUTION_TYPE_LABELS[type]}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {pack.features.length === 0 && <span className="text-gray-400">—</span>}
                                            {pack.features.map((feature) => (
                                                <span key={feature} className="rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-[11px] font-semibold">
                                                    {PACK_FEATURES.find((f) => f.key === feature)?.label ?? feature}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">{pack._count?.schools ?? 0}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => openEdit(pack)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50"
                                            >
                                                Modifier
                                            </button>
                                            {!pack.isDefault && pack.active && (
                                                <button
                                                    disabled={busyId === pack.id}
                                                    onClick={() => runOn(pack.id, () => setDefaultPack(pack.id))}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                                >
                                                    Par défaut
                                                </button>
                                            )}
                                            {!pack.isDefault && (
                                                <button
                                                    disabled={busyId === pack.id}
                                                    onClick={() => runOn(pack.id, () => updatePack(pack.id, { active: !pack.active }))}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                                >
                                                    {pack.active ? 'Désactiver' : 'Activer'}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le pack' : 'Nouveau pack'} size="lg">
                <form onSubmit={save} className="space-y-4">
                    {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{error}</p>}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Nom</label>
                            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                        </div>
                        <div>
                            <label className={labelCls}>Code (a-z, 0-9, -)</label>
                            <input className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
                        </div>
                        <div>
                            <label className={labelCls}>Prix mensuel (MAD)</label>
                            <input type="number" min="0" className={inputCls} value={form.monthlyPrice} onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })} required />
                        </div>
                        <div>
                            <label className={labelCls}>Prix annuel (MAD)</label>
                            <input type="number" min="0" className={inputCls} value={form.yearlyPrice} onChange={(e) => setForm({ ...form, yearlyPrice: e.target.value })} required />
                        </div>
                        <div>
                            <label className={labelCls}>Max. élèves (vide = illimité)</label>
                            <input type="number" min="1" className={inputCls} value={form.maxStudents} onChange={(e) => setForm({ ...form, maxStudents: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>Max. établissements (vide = illimité)</label>
                            <input type="number" min="1" className={inputCls} value={form.maxBranches} onChange={(e) => setForm({ ...form, maxBranches: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>Ordre d&apos;affichage</label>
                            <input type="number" className={inputCls} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-700 mt-6">
                            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                            Pack actif
                        </label>
                    </div>

                    <fieldset>
                        <legend className={labelCls}>Types d&apos;établissement</legend>
                        <div className="flex flex-wrap gap-3">
                            {INSTITUTION_TYPES.map((type) => (
                                <label key={type} className="flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={form.institutionTypes.includes(type)}
                                        onChange={() => setForm({ ...form, institutionTypes: toggle(form.institutionTypes, type) })}
                                    />
                                    {INSTITUTION_TYPE_LABELS[type]}
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <fieldset>
                        <legend className={labelCls}>Fonctionnalités incluses</legend>
                        <div className="flex flex-wrap gap-3">
                            {PACK_FEATURES.map((feature) => (
                                <label key={feature.key} className="flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={form.features.includes(feature.key)}
                                        onChange={() => setForm({ ...form, features: toggle(form.features, feature.key) })}
                                    />
                                    {feature.label}
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50">
                            Annuler
                        </button>
                        <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
                            {saving ? 'Enregistrement…' : 'Enregistrer'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
```

- [ ] **Step 2: Sidebar entry.** In `components/Sidebar.tsx` add `Package` to the `lucide-react` import list, and in `superAdminMenuItems` insert this item right after the `schools` entry:

```tsx
    {
      id: 'packs',
      label: 'Packs',
      icon: Package,
      path: '/admin/packs',
      activeColor: 'bg-[#334155]/50 border-[#FBBF24]',
      iconColor: 'text-[#FBBF24]'
    },
```

- [ ] **Step 3: Verify.** `npx tsc --noEmit` → 0 errors. (If `Modal`'s `size` prop rejects `"lg"`, use one of the sizes declared in `components/ui/Modal.tsx`.)

- [ ] **Step 4: Commit**

```bash
git add app/admin/packs components/Sidebar.tsx
git commit -m "feat(education): super admin packs page and sidebar entry

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Schools page — type and pack columns

**Files:** Modify `app/admin/schools/page.tsx`

- [ ] **Step 1: Imports and state.** Add to the imports: `import { INSTITUTION_TYPE_LABELS, DEFAULT_INSTITUTION_TYPE } from '@/lib/institutionTypes';` and `import { apiErrorMessage, assignSchoolPack, getAllPacks, type AdminPack } from '@/lib/services/packs';`. Inside the component, next to the existing `useState` hooks add:

```tsx
    const [packs, setPacks] = useState<AdminPack[]>([]);
    const [assigningId, setAssigningId] = useState<string | null>(null);
```

- [ ] **Step 2: Load packs with the schools.** In `fetchSchools`, replace `const data = await getAllSchools(); setSchools(data);` with:

```tsx
            const [data, allPacks] = await Promise.all([getAllSchools(), getAllPacks()]);
            setSchools(data);
            setPacks(allPacks);
```

- [ ] **Step 3: Assign handler** (add below `handleActivate`):

```tsx
    const handleAssignPack = async (schoolId: string, packId: string) => {
        if (!packId) return;
        setAssigningId(schoolId);
        setError('');
        try {
            await assignSchoolPack(schoolId, packId);
            await fetchSchools();
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setAssigningId(null);
        }
    };
```

- [ ] **Step 4: Columns.** In the `<thead>` row add, after the `Fin essai` header: `<th className="px-6 py-4">Type</th>` and `<th className="px-6 py-4">Pack</th>`. In each `<tr>` add, after the `Fin essai` cell:

```tsx
                                    <td className="px-6 py-4 text-gray-600">
                                        {INSTITUTION_TYPE_LABELS[school.institutionType ?? DEFAULT_INSTITUTION_TYPE]}
                                    </td>
                                    <td className="px-6 py-4">
                                        <select
                                            value={school.packId ?? ''}
                                            disabled={assigningId === school.id}
                                            onChange={(e) => handleAssignPack(school.id, e.target.value)}
                                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-50"
                                        >
                                            {!school.packId && <option value="">Aucun pack</option>}
                                            {packs
                                                .filter((pack) => pack.active && pack.institutionTypes.includes(school.institutionType ?? DEFAULT_INSTITUTION_TYPE))
                                                .map((pack) => (
                                                    <option key={pack.id} value={pack.id}>
                                                        {pack.name}
                                                    </option>
                                                ))}
                                        </select>
                                    </td>
```

- [ ] **Step 5: Verify + commit.** `npx tsc --noEmit` → 0 errors, then:

```bash
git add app/admin/schools/page.tsx
git commit -m "feat(education): pack and institution type columns on the super admin schools page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Type-aware sidebar

**Files:** Modify `hooks/useSchoolProfile.ts`, `components/Sidebar.tsx`

- [ ] **Step 1: Profile carries the type.** In `hooks/useSchoolProfile.ts` add `import type { InstitutionType } from '@/lib/institutionTypes';`, add to the `SchoolProfile` interface `institutionType?: InstitutionType | null;`, and in `loadProfile`'s `const next: SchoolProfile = {…}` add `institutionType: school.institutionType ?? null,`.

- [ ] **Step 2: Apply the menu adaptation.** In `components/Sidebar.tsx`: add `BookOpen` to the `lucide-react` imports and `import { applyInstitutionType, getInstitutionTypeConfig } from '@/lib/institutionTypes';`. Directly after the `const menuItems = …;` block add:

```tsx
  const typeConfig = getInstitutionTypeConfig(profile.institutionType);
  const visibleMenuItems: any[] = [
    ...applyInstitutionType(menuItems as any[], profile.institutionType),
    ...typeConfig.comingSoon.map((entry) => ({
      ...entry,
      icon: BookOpen,
      activeColor: 'bg-[#334155]/50 border-[#FBBF24]',
      iconColor: 'text-[#FBBF24]',
      comingSoon: true,
    })),
  ];
```

Then change the render loop `{menuItems.map((item) => {` to `{visibleMenuItems.map((item) => {`. For the non-submenu button (the `<button onClick={() => handleNavigation(item.path!)}` block) replace its opening tag props and label with:

```tsx
                  <button
                    onClick={() => !item.comingSoon && handleNavigation(item.path!)}
                    disabled={item.comingSoon}
                    className={`
                      w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 group relative overflow-hidden
                      ${item.comingSoon ? 'opacity-60 cursor-not-allowed text-slate-400' : activeClass}
                    `}
                  >
```

and after the existing `<span className="font-semibold text-[13px]">{item.label}</span>` inside that button add:

```tsx
                    {item.comingSoon && (
                      <span className="ml-auto rounded-full bg-amber-400/20 text-amber-300 px-2 py-0.5 text-[10px] font-bold">Bientôt</span>
                    )}
```

- [ ] **Step 3: Verify.** `npx tsc --noEmit` → 0 errors. Manual check later in Task 8 (log in as a crèche owner: "Enfants" group, no Formation Pro, "Journal quotidien · Bientôt").

- [ ] **Step 4: Commit**

```bash
git add hooks/useSchoolProfile.ts components/Sidebar.tsx
git commit -m "feat(education): adapt sidebar menus and wording to the institution type

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Landing foundations (messages, illustration, hooks)

**Files:** Create `lib/landing/messages.ts`, `lib/landing/useLandingLang.ts`, `lib/landing/whatsapp.ts`, `public/landing/dashboard.svg`

- [ ] **Step 1: The dashboard illustration** `public/landing/dashboard.svg` (dark palette hard-coded, no words):

```svg
<svg viewBox="0 0 560 400" width="560" height="400" xmlns="http://www.w3.org/2000/svg" font-family="Inter,Cairo,sans-serif">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#7c3aed"/></linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#818cf8"/><stop offset="1" stop-color="#6366f1"/></linearGradient>
  </defs>
  <!-- window -->
  <rect x="0" y="0" width="560" height="400" rx="18" style="fill:#131a30"/>
  <circle cx="22" cy="20" r="5" style="fill:#22294a"/><circle cx="40" cy="20" r="5" style="fill:#22294a"/><circle cx="58" cy="20" r="5" style="fill:#22294a"/>
  <!-- sidebar -->
  <rect x="0" y="40" width="112" height="360" style="fill:#0b1020"/>
  <rect x="16" y="56" width="26" height="26" rx="8" fill="url(#g)"/>
  <rect x="50" y="63" width="46" height="12" rx="6" style="fill:#22294a"/>
  <rect x="12" y="102" width="88" height="30" rx="9" fill="url(#g)"/><circle cx="28" cy="117" r="6" fill="#fff" opacity=".9"/><rect x="42" y="113" width="46" height="8" rx="4" fill="#fff" opacity=".85"/>
  <g style="fill:#22294a">
    <circle cx="28" cy="153" r="6"/><rect x="42" y="149" width="40" height="8" rx="4"/>
    <circle cx="28" cy="189" r="6"/><rect x="42" y="185" width="52" height="8" rx="4"/>
    <circle cx="28" cy="225" r="6"/><rect x="42" y="221" width="36" height="8" rx="4"/>
    <circle cx="28" cy="261" r="6"/><rect x="42" y="257" width="48" height="8" rx="4"/>
  </g>
  <!-- header -->
  <rect x="130" y="54" width="120" height="12" rx="6" style="fill:#f1f5f9" opacity=".85"/>
  <rect x="130" y="74" width="80" height="8" rx="4" style="fill:#22294a"/>
  <circle cx="520" cy="66" r="14" fill="url(#g)"/>
  <!-- stat cards -->
  <g>
    <rect x="130" y="98" width="128" height="72" rx="12" style="fill:#0b1020"/>
    <text x="144" y="122" font-size="18">🎓</text>
    <text x="144" y="154" font-size="22" font-weight="800" style="fill:#f1f5f9">1 240</text>
    <rect x="212" y="112" width="34" height="14" rx="7" fill="#10b981" opacity=".18"/><text x="218" y="123" font-size="9" font-weight="700" fill="#10b981">+8%</text>

    <rect x="270" y="98" width="128" height="72" rx="12" style="fill:#0b1020"/>
    <text x="284" y="122" font-size="18">✅</text>
    <text x="284" y="154" font-size="22" font-weight="800" style="fill:#f1f5f9">96%</text>
    <rect x="352" y="112" width="34" height="14" rx="7" fill="#10b981" opacity=".18"/><text x="358" y="123" font-size="9" font-weight="700" fill="#10b981">+2%</text>

    <rect x="410" y="98" width="140" height="72" rx="12" style="fill:#0b1020"/>
    <text x="424" y="122" font-size="18">💰</text>
    <text x="424" y="154" font-size="20" font-weight="800" style="fill:#f1f5f9">184 500</text>
    <rect x="502" y="112" width="34" height="14" rx="7" fill="#10b981" opacity=".18"/><text x="508" y="123" font-size="9" font-weight="700" fill="#10b981">+12%</text>
  </g>
  <!-- bar chart -->
  <rect x="130" y="184" width="238" height="200" rx="12" style="fill:#0b1020"/>
  <rect x="146" y="200" width="70" height="10" rx="5" style="fill:#f1f5f9" opacity=".8"/>
  <g style="stroke:#22294a" stroke-width="1"><line x1="146" y1="270" x2="352" y2="270"/><line x1="146" y1="310" x2="352" y2="310"/><line x1="146" y1="350" x2="352" y2="350"/></g>
  <g fill="url(#bar)">
    <rect x="152" y="300" width="20" height="50" rx="5"/>
    <rect x="182" y="282" width="20" height="68" rx="5"/>
    <rect x="212" y="292" width="20" height="58" rx="5"/>
    <rect x="242" y="262" width="20" height="88" rx="5"/>
    <rect x="272" y="244" width="20" height="106" rx="5"/>
    <rect x="302" y="226" width="20" height="124" rx="5" fill="url(#g)"/>
    <rect x="332" y="254" width="20" height="96" rx="5"/>
  </g>
  <polyline points="162,296 192,276 222,286 252,254 282,236 312,218 342,246" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="312" cy="218" r="4.5" fill="#f59e0b"/>
  <!-- attendance list -->
  <rect x="380" y="184" width="170" height="96" rx="12" style="fill:#0b1020"/>
  <g>
    <circle cx="398" cy="205" r="9" fill="#a5b4fc"/><rect x="414" y="199" width="54" height="8" rx="4" style="fill:#f1f5f9" opacity=".7"/><rect x="500" y="199" width="36" height="12" rx="6" fill="#10b981" opacity=".22"/><circle cx="518" cy="205" r="3" fill="#10b981"/>
    <circle cx="398" cy="235" r="9" fill="#fcd34d"/><rect x="414" y="229" width="46" height="8" rx="4" style="fill:#f1f5f9" opacity=".7"/><rect x="500" y="229" width="36" height="12" rx="6" fill="#f59e0b" opacity=".22"/><circle cx="518" cy="235" r="3" fill="#f59e0b"/>
    <circle cx="398" cy="265" r="9" fill="#fda4af"/><rect x="414" y="259" width="58" height="8" rx="4" style="fill:#f1f5f9" opacity=".7"/><rect x="500" y="259" width="36" height="12" rx="6" fill="#ef4444" opacity=".22"/><circle cx="518" cy="265" r="3" fill="#ef4444"/>
  </g>
  <!-- bus route -->
  <rect x="380" y="292" width="170" height="92" rx="12" style="fill:#0b1020"/>
  <text x="394" y="316" font-size="16">🚌</text>
  <rect x="418" y="306" width="60" height="8" rx="4" style="fill:#f1f5f9" opacity=".7"/>
  <path d="M398 350 C 430 330, 450 372, 482 350 S 524 336, 534 352" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-dasharray="5 5" stroke-linecap="round"/>
  <circle cx="398" cy="350" r="5" fill="#10b981"/><circle cx="466" cy="358" r="5" fill="#6366f1"/><circle cx="534" cy="352" r="5" fill="#f59e0b"/>
  <rect x="394" y="366" width="24" height="7" rx="3.5" style="fill:#22294a"/><rect x="454" y="370" width="24" height="7" rx="3.5" style="fill:#22294a"/>
</svg>
```

- [ ] **Step 2: `lib/landing/messages.ts`** — one typed dictionary; TypeScript enforces that `ar` has exactly the keys of `fr`. Arabic is Modern Standard Arabic. Keys not referenced by a component are harmless.

```ts
export type Lang = 'fr' | 'ar';

const fr = {nav_pricing:"Tarifs",nav_login:"Connexion",badge:"15 jours d'essai gratuit",
h1:"Gérez votre école simplement, de l'inscription au transport.",
lead:"Élèves, paiements, présences par QR, transport scolaire et portail parents — dans une seule plateforme, en arabe et en français.",
cta1:"Essayer 15 jours gratuits",cta2:"Voir les fonctionnalités",nocard:"Sans carte bancaire · Sans engagement",
present:"Présent",late:"En retard",absent:"Absent",

f_title:"Tout ce dont votre école a besoin",f_sub:"Des outils pensés pour les écoles privées, centres de soutien, de formation et de langues, et crèches au Maroc.",
f1t:"Portail parents",f1d:"Présence, solde et transport de leur enfant, via un simple lien.",
f2t:"Présence par QR",f2d:"Scannez, c'est noté. Les absences sont visibles tout de suite.",
f3t:"Transport scolaire",f3d:"Lignes, arrêts, horaires, chauffeurs et abonnements mensuels.",
f4t:"Paiements & finances",f4d:"Inscriptions, mensualités, reçus et suivi des impayés.",
f5t:"Multi-établissements",f5d:"Plusieurs sites, une seule vue d'ensemble pour le propriétaire.",
f6t:"Annonces & vacances",f6d:"Informez élèves et parents en un clic.",
f9t:"Portail élève",f9d:"Chaque élève consulte son profil, ses présences et ses paiements via son propre lien.",
f11t:"Gestion du personnel",f11d:"Enseignants, secrétaires, rôles d'accès et suivi des salaires.",
f10t:"Gestion des formations",f10d:"Catalogue de formations, inscriptions, groupes et suivi des paiements.",
t_title:"Une solution pour chaque type d'établissement",t_sub:"Écoles, centres de soutien, formation professionnelle, langues : activez ce dont vous avez besoin.",
pick_type:"Choisissez votre type d'établissement :",l4:"Jusqu'à 40 enfants · 1 établissement",c1:"Enfants, présence, paiements",c2:"Portail parents",c3:"Reçus et suivi des mensualités",c4:"Journal quotidien",
ty1:"Écoles privées",ty2:"Centres de soutien scolaire",ty3:"Formation professionnelle",ty4:"Centres de langues",ty5:"Crèches et maternelles",ty6:"Réseaux d'établissements",
tg_enrol:"Inscriptions",tg_parents:"Portail parents",tg_transport:"Transport",tg_groups:"Groupes et niveaux",tg_qr:"Présence QR",tg_monthly:"Mensualités",tg_formations:"Formations",tg_docs:"Attestations",tg_student:"Portail élève",tg_sites:"Multi-sites",tg_owner:"Vue propriétaire",tg_finance:"Finances",
f8t:"Cantine scolaire",f8d:"Menus, inscriptions et paiements de la cantine.",soon:"Bientôt",
f7t:"Inscrivez votre école sur SmartCities Maroc",f7d:"Rejoignez l'annuaire SmartCities Maroc et gagnez en visibilité auprès des familles.",
p_title:"Des tarifs clairs en dirhams",p_sub:"Choisissez selon la taille de votre école. Changez à tout moment.",
monthly:"Mensuel",yearly:"Annuel (2 mois offerts)",popular:"Le plus choisi",
l1:"Jusqu'à 100 élèves · 1 établissement",l2:"Jusqu'à 300 élèves · 2 établissements",l3:"Élèves illimités · multi-établissements",
a1:"Élèves, inscriptions, paiements",a2:"Présences & reçus",a3:"Portail parents & élèves",a4:"Présence QR & finance avancée",a5:"Transport scolaire",
try:"Essayer 15 jours",p_note:"Pro + Transport disponible sur demande.",
h_title:"Démarrez en 3 étapes",st1t:"Créez votre école",st1d:"Inscription en 1 minute.",st2t:"Ajoutez vos élèves",st2d:"Saisie ou import simple.",st3t:"Encaissez et suivez",st3d:"Paiements, présences, transport.",
fin_t:"Prêt à simplifier la gestion de votre école ?",fin_d:"15 jours gratuits, sans carte bancaire.",per_m:" / mois",per_y:" / an",
feat_PARENT_PORTAL:"Portail parents",feat_STUDENT_PORTAL:"Portail élève",feat_QR_ATTENDANCE:"Présence par QR",feat_ANNOUNCEMENTS:"Annonces & vacances",feat_FINANCE_ANALYTICS:"Finance avancée",feat_TRANSPORT:"Transport scolaire",feat_DAILY_LOG:"Journal quotidien",
lim_students:"Jusqu'à {n} élèves",lim_children:"Jusqu'à {n} enfants",lim_students_unlimited:"Élèves illimités",lim_children_unlimited:"Enfants illimités",lim_branch_one:"1 établissement",lim_branches:"{n} établissements",lim_branches_two:"2 établissements",lim_branches_unlimited:"Multi-établissements",
yearly_note:"2 mois offerts",packs_error:"Les tarifs ne sont pas disponibles pour le moment.",packs_error_cta:"Créer mon compte",wa_label:"WhatsApp",lang_switch:"العربية"
};

export type Messages = Record<keyof typeof fr, string>;

const ar: Messages = {nav_pricing:"الأسعار",nav_login:"تسجيل الدخول",badge:"تجربة مجانية لمدة 15 يومًا",
h1:"أدِر مدرستك بسهولة، من التسجيل إلى النقل المدرسي.",
lead:"التلاميذ والمدفوعات والحضور بالرمز QR والنقل المدرسي وبوابة أولياء الأمور، كل ذلك في منصة واحدة وباللغتين العربية والفرنسية.",
cta1:"جرّب مجانًا لمدة 15 يومًا",cta2:"اكتشف المميزات",nocard:"بدون بطاقة مصرفية · بدون التزام",
present:"حاضر",late:"متأخر",absent:"غائب",

f_title:"كل ما تحتاجه مدرستك",f_sub:"أدوات مصمَّمة للمدارس الخاصة ومراكز الدعم والتكوين ومعاهد اللغات والحضانات في المغرب.",
f1t:"بوابة أولياء الأمور",f1d:"يتابعون حضور أبنائهم ورصيدهم ونقلهم المدرسي عبر رابط بسيط.",
f2t:"الحضور بالرمز QR",f2d:"امسح الرمز فيُسجَّل الحضور فورًا، وتظهر الغيابات مباشرة.",
f3t:"النقل المدرسي",f3d:"الخطوط والمحطات والأوقات والسائقون والاشتراكات الشهرية.",
f4t:"المدفوعات والمالية",f4d:"التسجيل والمستحقات الشهرية والإيصالات ومتابعة المتأخرات.",
f5t:"تعدد المؤسسات",f5d:"عدة فروع مع رؤية شاملة واحدة للمالك.",
f6t:"الإعلانات والعطل",f6d:"أبلغ التلاميذ وأولياء الأمور بنقرة واحدة.",
f9t:"بوابة التلميذ",f9d:"يطّلع كل تلميذ على ملفه وحضوره ومدفوعاته عبر رابطه الخاص.",
f11t:"تدبير الموظفين",f11d:"الأساتذة والكتّاب وصلاحيات الولوج ومتابعة الأجور.",
f10t:"تدبير التكوينات",f10d:"لائحة التكوينات والتسجيل والمجموعات ومتابعة المدفوعات.",
t_title:"حل مناسب لكل أنواع المؤسسات التعليمية",t_sub:"مدارس ومراكز دعم وتكوين مهني ولغات: فعّل ما تحتاجه فقط.",
pick_type:"اختر نوع مؤسستك:",l4:"حتى 40 طفلًا · مؤسسة واحدة",c1:"الأطفال والحضور والمدفوعات",c2:"بوابة أولياء الأمور",c3:"الإيصالات ومتابعة المستحقات الشهرية",c4:"السجل اليومي",
ty1:"المدارس الخاصة",ty2:"مراكز الدعم التربوي",ty3:"مراكز التكوين المهني",ty4:"معاهد اللغات",ty5:"الحضانات والتعليم الأولي",ty6:"شبكات المؤسسات",
tg_enrol:"التسجيل",tg_parents:"بوابة الأولياء",tg_transport:"النقل",tg_groups:"المجموعات والمستويات",tg_qr:"حضور QR",tg_monthly:"المستحقات الشهرية",tg_formations:"التكوينات",tg_docs:"الشهادات",tg_student:"بوابة التلميذ",tg_sites:"فروع متعددة",tg_owner:"رؤية المالك",tg_finance:"المالية",
f8t:"المطعم المدرسي",f8d:"قوائم الوجبات وتسجيل التلاميذ ومدفوعات المطعم المدرسي.",soon:"قريبًا",
f7t:"سجّل مدرستك في SmartCities المغرب",f7d:"انضم إلى دليل SmartCities المغرب لتصل إلى مزيد من الأسر وتزداد مدرستك ظهورًا.",
p_title:"أسعار واضحة بالدرهم",p_sub:"اختر حسب حجم مدرستك، ويمكنك التغيير في أي وقت.",
monthly:"شهري",yearly:"سنوي (شهران مجانًا)",popular:"الأكثر اختيارًا",
l1:"حتى 100 تلميذ · مؤسسة واحدة",l2:"حتى 300 تلميذ · مؤسستان",l3:"عدد غير محدود من التلاميذ · مؤسسات متعددة",
a1:"التلاميذ والتسجيل والمدفوعات",a2:"الحضور والإيصالات",a3:"بوابة أولياء الأمور والتلاميذ",a4:"حضور QR ومالية متقدمة",a5:"النقل المدرسي",
try:"جرّب 15 يومًا",p_note:"باقة Pro مع النقل المدرسي متاحة عند الطلب.",
h_title:"ابدأ في ثلاث خطوات",st1t:"أنشئ مدرستك",st1d:"التسجيل في دقيقة واحدة.",st2t:"أضف التلاميذ",st2d:"إدخال أو استيراد بسيط.",st3t:"حصّل المدفوعات وتابع",st3d:"المدفوعات والحضور والنقل.",
fin_t:"هل أنت مستعد لتبسيط إدارة مدرستك؟",fin_d:"15 يومًا مجانًا، بدون بطاقة مصرفية.",per_m:" / شهر",per_y:" / سنة",
feat_PARENT_PORTAL:"بوابة أولياء الأمور",feat_STUDENT_PORTAL:"بوابة التلميذ",feat_QR_ATTENDANCE:"حضور بالرمز QR",feat_ANNOUNCEMENTS:"الإعلانات والعطل",feat_FINANCE_ANALYTICS:"مالية متقدمة",feat_TRANSPORT:"النقل المدرسي",feat_DAILY_LOG:"السجل اليومي",
lim_students:"حتى {n} تلميذًا",lim_children:"حتى {n} طفلًا",lim_students_unlimited:"عدد غير محدود من التلاميذ",lim_children_unlimited:"عدد غير محدود من الأطفال",lim_branch_one:"مؤسسة واحدة",lim_branches:"{n} مؤسسات",lim_branches_two:"مؤسستان",lim_branches_unlimited:"مؤسسات متعددة",
yearly_note:"شهران مجانًا",packs_error:"الأسعار غير متاحة حاليًا.",packs_error_cta:"أنشئ حسابي",wa_label:"واتساب",lang_switch:"Français"
};

export const messages: Record<Lang, Messages> = { fr, ar };
```

- [ ] **Step 3: `lib/landing/useLandingLang.ts`**

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Lang } from './messages';

const STORAGE_KEY = 'landing-lang';

// French by default; Arabic when the browser is Arabic; a saved choice always wins.
// Starts as 'fr' on the server and first client render (no hydration mismatch), then adjusts.
export function useLandingLang(): [Lang, (lang: Lang) => void] {
    const [lang, setLangState] = useState<Lang>('fr');

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'fr' || saved === 'ar') {
                setLangState(saved);
                return;
            }
        } catch {
            // storage unavailable: fall through to the browser language
        }
        if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ar')) {
            setLangState('ar');
        }
    }, []);

    const setLang = useCallback((next: Lang) => {
        setLangState(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // ignore
        }
    }, []);

    return [lang, setLang];
}
```

- [ ] **Step 4: `lib/landing/whatsapp.ts`**

```ts
// Temporary default number; override with NEXT_PUBLIC_WHATSAPP_NUMBER (any local or international format).
const DEFAULT_NUMBER = '0608183886';

export const whatsappUrl = (raw: string = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || DEFAULT_NUMBER): string => {
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = `212${digits.slice(1)}`;
    return `https://wa.me/${digits}`;
};
```

- [ ] **Step 5: Verify + commit.** `npx tsc --noEmit` → 0 errors (a missing/extra key in `ar` fails here). Then:

```bash
git add lib/landing public/landing
git commit -m "feat(education): landing messages (fr/ar), illustration, language and WhatsApp helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Landing components and page

**Files:** Create `components/landing/{LandingNav,Hero,FeaturesSection,TypesSection,PricingSection,StepsAndCta,WhatsAppButton,LandingPage}.tsx`; Modify `app/page.tsx`

All components take `m: Messages` (from `messages[lang]`), use logical Tailwind utilities (`ms-`, `me-`, `text-start`, `start-`/`end-`) so the RTL flip needs no separate styles, and the dark palette `#0b1020` (page), `#131a30` (cards), `#22294a` (borders).

- [ ] **Step 1: `components/landing/LandingNav.tsx`**

```tsx
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import type { Lang, Messages } from '@/lib/landing/messages';

interface Props {
    m: Messages;
    lang: Lang;
    onLangChange: (lang: Lang) => void;
}

export default function LandingNav({ m, lang, onLangChange }: Props) {
    return (
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <Link href="/" className="flex items-center gap-2 text-xl font-extrabold">
                <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-indigo-400 to-violet-500 text-white">
                    <GraduationCap size={18} />
                </span>
                Smart School
            </Link>
            <div className="flex items-center gap-2">
                <a href="#pricing" className="hidden rounded-full border border-[#22294a] bg-[#131a30] px-4 py-1.5 text-sm font-semibold text-slate-200 hover:bg-[#1a2342] sm:inline-block">
                    {m.nav_pricing}
                </a>
                <button
                    type="button"
                    onClick={() => onLangChange(lang === 'fr' ? 'ar' : 'fr')}
                    className="rounded-full border border-[#22294a] bg-[#131a30] px-4 py-1.5 text-sm font-semibold text-slate-200 hover:bg-[#1a2342]"
                    aria-label={lang === 'fr' ? 'العربية' : 'Français'}
                >
                    {m.lang_switch}
                </button>
                <Link href="/login" className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 px-4 py-2 text-sm font-bold text-white">
                    {m.nav_login}
                </Link>
            </div>
        </nav>
    );
}
```

- [ ] **Step 2: `components/landing/Hero.tsx`**

```tsx
import type { Messages } from '@/lib/landing/messages';

export default function Hero({ m }: { m: Messages }) {
    return (
        <header className="bg-[radial-gradient(1200px_500px_at_70%_-10%,#312e81_0,transparent_60%)]">
            <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 lg:grid-cols-[1.1fr_.9fr]">
                <div>
                    <span className="inline-block rounded-full bg-amber-400/15 px-3 py-1 text-sm font-bold text-amber-400">
                        {m.badge}
                    </span>
                    <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">{m.h1}</h1>
                    <p className="mt-4 max-w-xl text-lg text-slate-400">{m.lead}</p>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <a href="#pricing" className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 px-6 py-3 font-bold text-white shadow-lg shadow-indigo-500/30">
                            {m.cta1}
                        </a>
                        <a href="#features" className="rounded-xl border border-[#22294a] px-6 py-3 font-bold text-slate-100 hover:bg-[#131a30]">
                            {m.cta2}
                        </a>
                    </div>
                    <p className="mt-4 text-sm text-slate-500">{m.nocard}</p>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/landing/dashboard.svg"
                    alt=""
                    aria-hidden="true"
                    width={560}
                    height={400}
                    className="w-full rounded-2xl shadow-[0_30px_60px_-30px_rgba(99,102,241,.55)]"
                />
            </div>
        </header>
    );
}
```

- [ ] **Step 3: `components/landing/FeaturesSection.tsx`**

```tsx
import type { Messages } from '@/lib/landing/messages';

type Key = keyof Messages;

const FEATURES: { icon: string; title: Key; text: Key; soon?: boolean }[] = [
    { icon: '👨‍👩‍👧', title: 'f1t', text: 'f1d' },
    { icon: '🧑‍🎓', title: 'f9t', text: 'f9d' },
    { icon: '📷', title: 'f2t', text: 'f2d' },
    { icon: '🚌', title: 'f3t', text: 'f3d' },
    { icon: '💰', title: 'f4t', text: 'f4d' },
    { icon: '📚', title: 'f10t', text: 'f10d' },
    { icon: '👥', title: 'f11t', text: 'f11d' },
    { icon: '🏫', title: 'f5t', text: 'f5d' },
    { icon: '📢', title: 'f6t', text: 'f6d' },
    { icon: '🍽️', title: 'f8t', text: 'f8d', soon: true },
];

export default function FeaturesSection({ m }: { m: Messages }) {
    return (
        <section id="features" className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-center text-3xl font-extrabold">{m.f_title}</h2>
            <p className="mb-8 mt-2 text-center text-slate-400">{m.f_sub}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {FEATURES.map((feature) => (
                    <div key={feature.title} className="rounded-2xl border border-[#22294a] bg-[#131a30] p-5">
                        <div className="text-2xl">{feature.icon}</div>
                        <h3 className="mb-1 mt-2 text-base font-bold">
                            {m[feature.title]}
                            {feature.soon && (
                                <span className="ms-2 inline-block rounded-full bg-amber-400/20 px-2 py-0.5 align-middle text-[11px] font-bold text-amber-400">
                                    {m.soon}
                                </span>
                            )}
                        </h3>
                        <p className="text-sm text-slate-400">{m[feature.text]}</p>
                    </div>
                ))}
                <div className="flex items-center gap-4 rounded-2xl border border-indigo-400 bg-[#131a30] p-5 sm:col-span-2">
                    <div className="text-4xl">📍</div>
                    <div>
                        <h3 className="mb-1 text-base font-bold">{m.f7t}</h3>
                        <p className="text-sm text-slate-400">{m.f7d}</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
```

- [ ] **Step 4: `components/landing/TypesSection.tsx`**

```tsx
import type { Messages } from '@/lib/landing/messages';
import type { InstitutionType } from '@/lib/institutionTypes';

type Key = keyof Messages;

// `type: null` = school networks: not a type of its own, it only scrolls to pricing.
const TYPES: { icon: string; title: Key; type: InstitutionType | null; tags: Key[] }[] = [
    { icon: '🏫', title: 'ty1', type: 'PRIVATE_SCHOOL', tags: ['tg_enrol', 'tg_parents', 'tg_transport'] },
    { icon: '📝', title: 'ty2', type: 'TUTORING_CENTER', tags: ['tg_groups', 'tg_qr', 'tg_monthly'] },
    { icon: '🛠️', title: 'ty3', type: 'VOCATIONAL_TRAINING', tags: ['tg_formations', 'tg_docs', 'tg_monthly'] },
    { icon: '🗣️', title: 'ty4', type: 'LANGUAGE_CENTER', tags: ['tg_groups', 'tg_student', 'tg_monthly'] },
    { icon: '🧸', title: 'ty5', type: 'CRECHE', tags: ['tg_parents', 'tg_qr', 'tg_transport'] },
    { icon: '🏢', title: 'ty6', type: null, tags: ['tg_sites', 'tg_owner', 'tg_finance'] },
];

interface Props {
    m: Messages;
    onPick: (type: InstitutionType | null) => void;
}

export default function TypesSection({ m, onPick }: Props) {
    return (
        <section className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-center text-3xl font-extrabold">{m.t_title}</h2>
            <p className="mb-8 mt-2 text-center text-slate-400">{m.t_sub}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {TYPES.map((item) => (
                    <button
                        key={item.title}
                        type="button"
                        onClick={() => onPick(item.type)}
                        className="rounded-2xl border border-[#22294a] bg-[#131a30] p-5 text-start transition hover:border-indigo-400"
                    >
                        <div className="text-3xl">{item.icon}</div>
                        <h3 className="mb-3 mt-2 text-base font-bold">{m[item.title]}</h3>
                        <div className="flex flex-wrap gap-1.5">
                            {item.tags.map((tag) => (
                                <span key={tag} className="rounded-full bg-indigo-400/15 px-2.5 py-1 text-xs font-semibold text-indigo-300">
                                    {m[tag]}
                                </span>
                            ))}
                        </div>
                    </button>
                ))}
            </div>
        </section>
    );
}
```

- [ ] **Step 5: `components/landing/PricingSection.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Messages } from '@/lib/landing/messages';
import { INSTITUTION_TYPES, type InstitutionType } from '@/lib/institutionTypes';
import { fetchPublicPacks, type PublicPack } from '@/lib/services/packs';

const TYPE_TITLE_KEYS: Record<InstitutionType, keyof Messages> = {
    PRIVATE_SCHOOL: 'ty1',
    TUTORING_CENTER: 'ty2',
    VOCATIONAL_TRAINING: 'ty3',
    LANGUAGE_CENTER: 'ty4',
    CRECHE: 'ty5',
};

type Billing = 'm' | 'y';
type PacksState = { status: 'loading' } | { status: 'error' } | { status: 'ok'; packs: PublicPack[] };

const fill = (template: string, n: number) => template.replace('{n}', String(n));

const limitsLine = (pack: PublicPack, type: InstitutionType, m: Messages): string => {
    const creche = type === 'CRECHE';
    const students =
        pack.maxStudents === null
            ? creche ? m.lim_children_unlimited : m.lim_students_unlimited
            : fill(creche ? m.lim_children : m.lim_students, pack.maxStudents);
    const branches =
        pack.maxBranches === null
            ? m.lim_branches_unlimited
            : pack.maxBranches === 1
            ? m.lim_branch_one
            : pack.maxBranches === 2
            ? m.lim_branches_two
            : fill(m.lim_branches, pack.maxBranches);
    return `${students} · ${branches}`;
};

interface Props {
    m: Messages;
    type: InstitutionType;
    onTypeChange: (type: InstitutionType) => void;
}

export default function PricingSection({ m, type, onTypeChange }: Props) {
    const [billing, setBilling] = useState<Billing>('m');
    const [state, setState] = useState<PacksState>({ status: 'loading' });

    useEffect(() => {
        let cancelled = false;
        setState({ status: 'loading' });
        fetchPublicPacks(type)
            .then((packs) => !cancelled && setState({ status: 'ok', packs }))
            .catch(() => !cancelled && setState({ status: 'error' }));
        return () => {
            cancelled = true;
        };
    }, [type]);

    const price = (pack: PublicPack) => (billing === 'm' ? pack.monthlyPrice : pack.yearlyPrice);
    const twoMonthsFree = (pack: PublicPack) => pack.yearlyPrice < 12 * pack.monthlyPrice;

    return (
        <section id="pricing" className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-center text-3xl font-extrabold">{m.p_title}</h2>
            <p className="mb-6 mt-2 text-center text-slate-400">{m.p_sub}</p>

            <p className="mb-2 text-center text-sm text-slate-400">{m.pick_type}</p>
            <div className="mb-5 flex flex-wrap justify-center gap-2">
                {INSTITUTION_TYPES.map((item) => (
                    <button
                        key={item}
                        type="button"
                        aria-pressed={type === item}
                        onClick={() => onTypeChange(item)}
                        className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
                            type === item
                                ? 'border-indigo-400 bg-indigo-500 text-white'
                                : 'border-[#22294a] bg-[#131a30] text-slate-200 hover:bg-[#1a2342]'
                        }`}
                    >
                        {m[TYPE_TITLE_KEYS[item]]}
                    </button>
                ))}
            </div>

            <div className="mb-8 flex justify-center gap-2">
                {(['m', 'y'] as Billing[]).map((option) => (
                    <button
                        key={option}
                        type="button"
                        aria-pressed={billing === option}
                        onClick={() => setBilling(option)}
                        className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
                            billing === option
                                ? 'border-indigo-400 bg-indigo-500 text-white'
                                : 'border-[#22294a] bg-[#131a30] text-slate-200 hover:bg-[#1a2342]'
                        }`}
                    >
                        {option === 'm' ? m.monthly : m.yearly}
                    </button>
                ))}
            </div>

            {state.status === 'loading' && (
                <div className="grid gap-4 md:grid-cols-3" aria-busy="true">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-72 animate-pulse rounded-2xl border border-[#22294a] bg-[#131a30]" />
                    ))}
                </div>
            )}

            {state.status === 'error' && (
                <div className="mx-auto max-w-md rounded-2xl border border-[#22294a] bg-[#131a30] p-6 text-center">
                    <p className="text-slate-300">{m.packs_error}</p>
                    <Link href={`/signup?type=${type}`} className="mt-4 inline-block rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 px-5 py-2.5 font-bold text-white">
                        {m.packs_error_cta}
                    </Link>
                </div>
            )}

            {state.status === 'ok' && state.packs.length === 0 && (
                <p className="text-center text-slate-400">{m.packs_error}</p>
            )}

            {state.status === 'ok' && state.packs.length > 0 && (
                <div className={`mx-auto grid gap-4 ${state.packs.length === 1 ? 'max-w-sm' : 'md:grid-cols-3'}`}>
                    {state.packs.map((pack) => {
                        const baseLines = type === 'CRECHE' ? [m.c1, m.c3] : [m.a1, m.a2];
                        return (
                            <div
                                key={pack.code}
                                className={`relative rounded-2xl bg-[#131a30] p-6 ${
                                    pack.recommended ? 'border-2 border-indigo-400 md:-translate-y-1.5' : 'border border-[#22294a]'
                                }`}
                            >
                                {pack.recommended && (
                                    <span className="absolute -top-3 start-5 rounded-full bg-indigo-500 px-3 py-0.5 text-xs font-bold text-white">
                                        {m.popular}
                                    </span>
                                )}
                                <h3 className="text-lg font-bold">{pack.name}</h3>
                                <p className="mt-2 text-4xl font-extrabold">
                                    {price(pack).toLocaleString('fr-FR')}{' '}
                                    <small className="text-sm font-semibold text-slate-400">
                                        MAD{billing === 'm' ? m.per_m : m.per_y}
                                    </small>
                                </p>
                                {billing === 'y' && twoMonthsFree(pack) && (
                                    <p className="mt-1 text-xs font-semibold text-emerald-400">{m.yearly_note}</p>
                                )}
                                <p className="mb-3 mt-2 text-sm text-slate-400">{limitsLine(pack, type, m)}</p>
                                <ul className="mb-5 space-y-1.5 text-sm">
                                    {baseLines.map((line) => (
                                        <li key={line} className="flex gap-2">
                                            <span className="font-extrabold text-emerald-400">✓</span>
                                            {line}
                                        </li>
                                    ))}
                                    {pack.features.map((feature) => (
                                        <li key={feature} className="flex gap-2">
                                            <span className="font-extrabold text-emerald-400">✓</span>
                                            <span>
                                                {m[`feat_${feature}` as keyof Messages]}
                                                {feature === 'DAILY_LOG' && (
                                                    <span className="ms-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-bold text-amber-400">
                                                        {m.soon}
                                                    </span>
                                                )}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    href={`/signup?type=${type}&pack=${pack.code}`}
                                    className={`block rounded-xl px-5 py-3 text-center font-bold ${
                                        pack.recommended
                                            ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white'
                                            : 'border border-[#22294a] text-slate-100 hover:bg-[#1a2342]'
                                    }`}
                                >
                                    {m.try}
                                </Link>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
```

- [ ] **Step 6: `components/landing/StepsAndCta.tsx`**

```tsx
import type { Messages } from '@/lib/landing/messages';

export default function StepsAndCta({ m }: { m: Messages }) {
    const steps = [
        { title: m.st1t, text: m.st1d },
        { title: m.st2t, text: m.st2d },
        { title: m.st3t, text: m.st3d },
    ];

    return (
        <>
            <section className="mx-auto max-w-6xl px-5 py-16">
                <h2 className="mb-8 text-center text-3xl font-extrabold">{m.h_title}</h2>
                <div className="grid gap-6 md:grid-cols-3">
                    {steps.map((step, index) => (
                        <div key={step.title} className="text-center">
                            <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-indigo-500 font-bold text-white">
                                {index + 1}
                            </span>
                            <h3 className="font-bold">{step.title}</h3>
                            <p className="text-sm text-slate-400">{step.text}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-5 pb-16">
                <div className="rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-500 p-10 text-center">
                    <h2 className="text-3xl font-extrabold text-white">{m.fin_t}</h2>
                    <p className="mt-2 text-indigo-100">{m.fin_d}</p>
                    <a href="#pricing" className="mt-5 inline-block rounded-xl bg-white px-6 py-3 font-bold text-indigo-600">
                        {m.cta1}
                    </a>
                </div>
            </section>

            <footer className="py-8 text-center text-sm text-slate-500">© Smart School</footer>
        </>
    );
}
```

- [ ] **Step 7: `components/landing/WhatsAppButton.tsx`**

```tsx
import { whatsappUrl } from '@/lib/landing/whatsapp';

export default function WhatsAppButton({ label }: { label: string }) {
    return (
        <a
            href={whatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-5 end-5 z-30 rounded-full bg-green-500 px-5 py-3 font-bold text-white shadow-lg shadow-green-500/40"
        >
            💬 {label}
        </a>
    );
}
```

- [ ] **Step 8: `components/landing/LandingPage.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/store/useAuthStore';
import { messages } from '@/lib/landing/messages';
import { useLandingLang } from '@/lib/landing/useLandingLang';
import { DEFAULT_INSTITUTION_TYPE, isInstitutionType, type InstitutionType } from '@/lib/institutionTypes';
import LandingNav from './LandingNav';
import Hero from './Hero';
import FeaturesSection from './FeaturesSection';
import TypesSection from './TypesSection';
import PricingSection from './PricingSection';
import StepsAndCta from './StepsAndCta';
import WhatsAppButton from './WhatsAppButton';

const TYPE_STORAGE_KEY = 'landing-type';

export default function LandingPage() {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const [lang, setLang] = useLandingLang();
    const [type, setType] = useState<InstitutionType>(DEFAULT_INSTITUTION_TYPE);
    const m = messages[lang];

    // Already signed in: go to the role's home, like the login page does.
    useEffect(() => {
        if (!user) return;
        if (user.role === 'OWNER') router.replace('/admin/select-branch');
        else if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') router.replace('/admin');
        else if (user.role === 'SECRETARY') router.replace('/secretary');
    }, [user, router]);

    // Remember the chosen institution type.
    useEffect(() => {
        try {
            const saved = localStorage.getItem(TYPE_STORAGE_KEY);
            if (isInstitutionType(saved)) setType(saved);
        } catch {
            // storage unavailable
        }
    }, []);

    const changeType = (next: InstitutionType) => {
        setType(next);
        try {
            localStorage.setItem(TYPE_STORAGE_KEY, next);
        } catch {
            // ignore
        }
    };

    const pickType = (next: InstitutionType | null) => {
        if (next) changeType(next);
        document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            lang={lang}
            className="min-h-screen bg-[#0b1020] text-slate-100"
            style={{ fontFamily: lang === 'ar' ? 'Cairo, Inter, sans-serif' : 'Inter, Cairo, sans-serif' }}
        >
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <link
                rel="stylesheet"
                href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800&family=Inter:wght@400;600;800&display=swap"
            />
            <LandingNav m={m} lang={lang} onLangChange={setLang} />
            <Hero m={m} />
            <FeaturesSection m={m} />
            <TypesSection m={m} onPick={pickType} />
            <PricingSection m={m} type={type} onTypeChange={changeType} />
            <StepsAndCta m={m} />
            <WhatsAppButton label={m.wa_label} />
        </div>
    );
}
```

- [ ] **Step 9: Replace `app/page.tsx`** with:

```tsx
import LandingPage from '@/components/landing/LandingPage';

export default function HomePage() {
    return <LandingPage />;
}
```

- [ ] **Step 10: Verify.** `npx tsc --noEmit` → 0 errors, then `npx next lint --dir components/landing` if the project has an ESLint config (it may not — skip if it prompts). Fix real type errors (e.g. `m[feature.title]` needs `Key` typed as `keyof Messages`, already done).

- [ ] **Step 11: Commit**

```bash
git add components/landing app/page.tsx
git commit -m "feat(education): bilingual dark Smart School landing page with type-first pricing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Signup page — institution type and pack

**Files:** Modify `app/signup/page.tsx`

- [ ] **Step 1: Imports.** Replace the first import lines' React import with `import React, { Suspense, useEffect, useState } from 'react';` and add:

```tsx
import { useRouter, useSearchParams } from 'next/navigation';
import { INSTITUTION_TYPES, INSTITUTION_TYPE_LABELS, isInstitutionType, type InstitutionType } from '../../lib/institutionTypes';
import { fetchPublicPacks, type PublicPack } from '../../lib/services/packs';
```

(and drop the previous standalone `import { useRouter } from 'next/navigation';`).

- [ ] **Step 2: Rename the page and wrap it.** Rename `export default function SignupPage() {` to `function SignupForm() {` and append at the end of the file:

```tsx
export default function SignupPage() {
    // useSearchParams needs a Suspense boundary during the production build.
    return (
        <Suspense fallback={null}>
            <SignupForm />
        </Suspense>
    );
}
```

- [ ] **Step 3: State.** Inside `SignupForm`, replace the `useState<SignupSchoolData>({... institutionType: 'PRIVATE_SCHOOL' })` line from Task 1 with owner-only form state and add the type/pack state:

```tsx
    const searchParams = useSearchParams();
    const initialType = searchParams.get('type');
    const [form, setForm] = useState({ ownerName: '', ownerEmail: '', password: '' });
    const [institutionType, setInstitutionType] = useState<InstitutionType | ''>(
        isInstitutionType(initialType) ? initialType : ''
    );
    const [packCode, setPackCode] = useState<string>(searchParams.get('pack') ?? '');
    const [packs, setPacks] = useState<PublicPack[]>([]);

    // Load the packs that serve the chosen type; keep the requested pack if valid, else the recommended one.
    useEffect(() => {
        if (!institutionType) {
            setPacks([]);
            return;
        }
        let cancelled = false;
        fetchPublicPacks(institutionType)
            .then((list) => {
                if (cancelled) return;
                setPacks(list);
                setPackCode((current) =>
                    list.some((pack) => pack.code === current)
                        ? current
                        : list.find((pack) => pack.recommended)?.code ?? list[0]?.code ?? ''
                );
            })
            .catch(() => {
                if (!cancelled) {
                    setPacks([]);
                    setPackCode('');
                }
            });
        return () => {
            cancelled = true;
        };
    }, [institutionType]);
```

Change the `update` helper's type to `(field: 'ownerName' | 'ownerEmail' | 'password')`, and remove the now-unused `SignupSchoolData` import if TypeScript flags it.

- [ ] **Step 4: Submit.** In `handleSubmit`, before `setLoading(true)` add `if (!institutionType) { setError("Choisissez le type de votre établissement."); return; }`, and change the call to:

```tsx
            const { token, user, branch } = await signupSchool({
                ...form,
                institutionType,
                ...(packCode ? { packCode } : {}),
            });
```

- [ ] **Step 5: The UI.** In the form, insert this block **before** the first `<Input … placeholder="Votre nom" />`:

```tsx
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-slate-600" htmlFor="institutionType">
                                Type de votre établissement
                            </label>
                            <select
                                id="institutionType"
                                value={institutionType}
                                onChange={(e) => setInstitutionType(e.target.value as InstitutionType | '')}
                                required
                                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:outline-none font-bold text-lg shadow-sm"
                            >
                                <option value="">Choisir…</option>
                                {INSTITUTION_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                        {INSTITUTION_TYPE_LABELS[type]}
                                    </option>
                                ))}
                            </select>

                            {packs.length > 0 && (
                                <div className="grid gap-2" role="radiogroup" aria-label="Pack">
                                    {packs.map((pack) => (
                                        <label
                                            key={pack.code}
                                            className={`flex cursor-pointer items-center justify-between rounded-2xl border-2 px-5 py-3 ${
                                                packCode === pack.code ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 bg-slate-50'
                                            }`}
                                        >
                                            <span className="flex items-center gap-3 font-bold text-slate-800">
                                                <input
                                                    type="radio"
                                                    name="pack"
                                                    value={pack.code}
                                                    checked={packCode === pack.code}
                                                    onChange={() => setPackCode(pack.code)}
                                                />
                                                {pack.name}
                                                {pack.recommended && (
                                                    <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white">
                                                        Recommandé
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-sm font-semibold text-slate-500">
                                                {pack.monthlyPrice} MAD / mois
                                            </span>
                                        </label>
                                    ))}
                                    <p className="text-xs text-slate-400">15 jours d&apos;essai gratuit, sans carte bancaire.</p>
                                </div>
                            )}
                        </div>
```

- [ ] **Step 6: Verify + commit.** `npx tsc --noEmit` → 0 errors, then:

```bash
git add app/signup/page.tsx
git commit -m "feat(education): choose institution type and pack on the signup page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Build and manual QA

- [ ] **Step 1: Build.** `npx tsc --noEmit` (0 errors) and `npx next build` (must succeed; `/`, `/signup`, `/admin/packs` appear in the route list; a failure unrelated to these files is reported, not fixed).

- [ ] **Step 2: Start both apps** — backend (`npm run dev` in `apps/education-apps`, needs the backend plan merged and `npm run prisma:seed-packs` run once, with the user's OK) and frontend (`npx next dev -p 3011`). Never print `.env`.

- [ ] **Step 3: Landing checklist** at `http://localhost:3011/`: French by default; the language button switches to Arabic with `dir="rtl"` (text right-aligned, cards mirrored, WhatsApp button on the left) and the choice survives a reload; Arabic copy is Modern Standard Arabic (no dialect words); no statistics strip and no "made in Morocco" line; features grid is 4 columns on desktop, 2 on tablet, 1 on phone (resize), the SmartCities card spans two columns; Cantine shows "Bientôt/قريبًا"; clicking a type card selects that type in pricing and scrolls there; pricing shows 3 packs for the four general types and 1 pack (Crèche, with "Journal quotidien" + "Bientôt") for the crèche type; the monthly/yearly toggle changes prices (250/400/800 ↔ 2500/4000/8000; crèche 200 ↔ 2000) and shows "2 mois offerts"; stop the backend → the pricing section shows the error message with the signup link and the rest of the page still works; the WhatsApp button opens `https://wa.me/212608183886`; a signed-in user landing on `/` is redirected to their home.

- [ ] **Step 4: Signup checklist:** a pack CTA opens `/signup?type=…&pack=…` with the type and pack preselected; switching the type reloads the packs and selects the recommended one; submitting without a type shows the error; a successful signup creates the school with that type/pack (verify through `GET /api/schools/me` in the network tab or the Super Admin list).

- [ ] **Step 5: Super Admin checklist** (a SUPER_ADMIN account is needed; create one by the project's usual means or say it could not be tested): `/admin/packs` lists the 4 packs; create/edit a pack (checkboxes for the 7 features and 5 types, empty limit = unlimited); set another pack as default; deactivating the default is refused with a readable message; `/admin/schools` shows Type and Pack columns and the select only offers active packs that serve the school's type.

- [ ] **Step 6: Sidebar checklist:** as an owner of a crèche school the menu shows "Enfants" (with "Enfants"/"Sections" sub-items), no "Formation Pro", and a disabled "Journal quotidien — Bientôt"; a vocational-training owner sees "Formation Pro" right after the dashboard; private schools are unchanged.

- [ ] **Step 7: Clean up** any QA schools/users/packs you created (only those, by recorded ids), stop both servers, confirm the ports are free, and report results faithfully (what passed, what could not be tested and why).

---

## Self-Review

**Spec coverage:** Super Admin packs page with 7 feature and 5 type checkboxes, default and deactivate actions → Task 2. Schools page Type/Pack columns and assignment filtered by type → Task 3. Type-aware sidebar config in one file, crèche relabel/hide/"Journal quotidien — Bientôt", vocational Formations first → Tasks 1, 4. Landing: dark style B, bilingual with RTL and MSA Arabic, ten feature cards + SmartCities card, "every type" section, type-first pricing from `GET /api/packs/public?type=`, monthly/yearly toggle with "2 mois offerts" only when applicable, recommended badge, error fallback, WhatsApp default number, redirect when signed in, no stats strip / made-in-Morocco line → Tasks 5, 6. Signup with type/pack and `packCode`/`institutionType` payload → Tasks 1, 7. Type remembered in `localStorage` (refined from the spec's hash/localStorage wording).
**Placeholder scan:** none; the `{{…}}` markers were replaced with the real messages and SVG when this plan was generated.
**Type consistency:** `InstitutionType`, `PackFeature`, `PublicPack`/`AdminPack`/`PackFormInput`, `applyInstitutionType`/`getInstitutionTypeConfig`, `Messages`/`messages`/`Lang`, `fetchPublicPacks`/`getAllPacks`/`createPack`/`updatePack`/`setDefaultPack`/`assignSchoolPack` are defined in Tasks 1 and 5 and used unchanged in Tasks 2–7.
**Risks:** no frontend test runner (verification is `tsc`, `next build` and the manual checklist); Task 7 edits a large existing page by anchored instructions, so re-read the page before editing.
