# Crèche-Specific Student Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add crèche-only student fields (section, health notes, authorized pickup, massar for Grande) to the schema, backend and the enrollment form, without touching non-crèche behavior.

**Architecture:** Additive optional fields on `Student`; passthrough on the existing service/controller (same pattern as `schoolLevel`); the form conditionally renders a crèche card instead of the school card, driven by `useSchoolProfile().profile.institutionType`.

**Tech Stack:** Node/Express, Prisma 5/MongoDB, Jest+ts-jest; Next.js 14 frontend (no test runner — `tsc`/`next build`/manual QA).

**Spec:** `docs/superpowers/specs/2026-09-22-creche-student-fields-design.md`

**Conventions:** work on branch `feature/education-packs` (continues the current branch) or a new branch `feature/creche-student-fields` off it — either is fine, stay on one branch throughout. Backend commands from `apps/education-apps`, frontend from `apps/education-apps/frontend`. Baseline: backend `npx jest` all pass, `npx tsc --noEmit -p .` silent; frontend `npx tsc --noEmit` 0 errors. Commit trailer, verbatim: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

## File Structure

**Modify:** `prisma/schema.prisma`, `src/modules/students/students.service.ts` (+test), `src/modules/students/students.controller.ts`, `frontend/types/index.ts`, `frontend/components/forms/AddStudentForm.tsx`, `frontend/app/admin/students/[id]/page.tsx`, `frontend/app/p/[token]/page.tsx`.

---

### Task 1: Schema

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1:** In `model Student`, after `currentSchool  String?` add:

```prisma
  crecheSection    String? // NOURRISSON | MOYENNE | GRANDE — crèche only
  healthNotes      String? // allergies / health notes — crèche only
  authorizedPickup Json?   // [{ name, phone, relation }] — crèche only
  massarNumber     String? // set only when crecheSection = GRANDE
```

- [ ] **Step 2:** Run (from `apps/education-apps`): `npx prisma format && npx prisma validate && npx prisma generate && npx tsc --noEmit -p . && npx jest`. Expected: valid, tsc silent, all suites pass. Then `npx prisma db push` (additive; if it warns about data loss, STOP and ask the user).
- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(education): add crèche-specific optional fields to Student

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Backend passthrough

**Files:** Modify `src/modules/students/students.service.ts`, `src/modules/students/students.service.test.ts`, `src/modules/students/students.controller.ts`

- [ ] **Step 1: Write the failing tests.** Add to `students.service.test.ts` (find the existing `describe` block that tests `createStudent`/`updateStudent` field passthrough — mirror its exact mock/assert style for `schoolLevel`):

```ts
describe('crèche fields passthrough', () => {
    afterEach(() => jest.clearAllMocks());

    it('createStudent passes crèche fields through when given', async () => {
        (prisma.student.create as jest.Mock).mockResolvedValue({ id: 's1' });

        await createStudent({
            branchId: 'b1',
            name: 'A',
            surname: 'B',
            crecheSection: 'GRANDE',
            healthNotes: 'Allergie arachides',
            authorizedPickup: [{ name: 'Tata', phone: '0600000000', relation: 'Tante' }],
            massarNumber: 'M123456',
        } as any);

        expect(prisma.student.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    crecheSection: 'GRANDE',
                    healthNotes: 'Allergie arachides',
                    authorizedPickup: [{ name: 'Tata', phone: '0600000000', relation: 'Tante' }],
                    massarNumber: 'M123456',
                }),
            })
        );
    });

    it('createStudent omits crèche fields from the record when not given', async () => {
        (prisma.student.create as jest.Mock).mockResolvedValue({ id: 's1' });

        await createStudent({ branchId: 'b1', name: 'A', surname: 'B' } as any);

        const data = (prisma.student.create as jest.Mock).mock.calls[0][0].data;
        expect(data.crecheSection).toBeUndefined();
        expect(data.healthNotes).toBeUndefined();
        expect(data.authorizedPickup).toBeUndefined();
        expect(data.massarNumber).toBeUndefined();
    });

    it('updateStudent passes crèche fields through when given', async () => {
        (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 's1' });
        (prisma.student.update as jest.Mock).mockResolvedValue({ id: 's1' });

        await updateStudent('s1', 'b1', { crecheSection: 'MOYENNE', healthNotes: 'RAS' } as any);

        expect(prisma.student.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { crecheSection: 'MOYENNE', healthNotes: 'RAS' },
        });
    });
});
```

(If `createStudent`/`updateStudent` aren't already imported in the test file, they are — this task only adds a new `describe`.)

- [ ] **Step 2: Run to verify failure** — `npx jest src/modules/students` → TS errors (the interfaces don't have these fields) or assertion failures.

- [ ] **Step 3: Implement.** In `students.service.ts`, add to both `CreateStudentData` and `UpdateStudentData` (after `currentSchool?: string;`):

```ts
    crecheSection?: string;
    healthNotes?: string;
    authorizedPickup?: any;
    massarNumber?: string;
```

In `createStudent`'s `tx.student.create({ data: {...} })`, add after `currentSchool: data.currentSchool,`:

```ts
                crecheSection: data.crecheSection,
                healthNotes: data.healthNotes,
                authorizedPickup: data.authorizedPickup,
                massarNumber: data.massarNumber,
```

`updateStudent` already spreads `data` directly into `prisma.student.update({ data })`, so no change is needed there beyond the interface — confirm this by reading the function before editing.

- [ ] **Step 4: Controller.** In `students.controller.ts` `create`, destructure `crecheSection, healthNotes, authorizedPickup, massarNumber` from `req.body` alongside the existing fields, and add:

```ts
        if (crecheSection) studentData.crecheSection = crecheSection;
        if (healthNotes) studentData.healthNotes = healthNotes;
        if (authorizedPickup) studentData.authorizedPickup = authorizedPickup;
        if (massarNumber) studentData.massarNumber = massarNumber;
```

Check the `update` controller function (`students.controller.ts`, likely named `update`): if it builds `updateData` the same way as `create` (whitelisting fields with `if (x !== undefined) updateData.x = x;`), add the same four fields there; if it forwards `req.body` directly, no change is needed — read it first and report which case applies.

- [ ] **Step 5: Run + typecheck** — `npx jest src/modules/students && npx tsc --noEmit -p .` (pass, silent). Then full `npx jest`.

- [ ] **Step 6: Commit**

```bash
git add src/modules/students
git commit -m "feat(education): pass crèche student fields through create/update

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Frontend — enrollment form, profile page, parent portal

**Files:** Modify `frontend/types/index.ts`, `frontend/components/forms/AddStudentForm.tsx`, `frontend/app/admin/students/[id]/page.tsx`, `frontend/app/p/[token]/page.tsx`

- [ ] **Step 1: Baseline** — `npx tsc --noEmit` (record error count, expect 0).

- [ ] **Step 2: Types.** In `types/index.ts`, add to `interface Student` and `interface StudentFormData` (next to `currentSchool?: string;`):

```ts
    crecheSection?: 'NOURRISSON' | 'MOYENNE' | 'GRANDE';
    healthNotes?: string;
    authorizedPickup?: { name: string; phone: string; relation: string }[];
    massarNumber?: string;
```

- [ ] **Step 3: The form.** In `AddStudentForm.tsx`:
  - Read the institution type: `const institutionType = profile.institutionType;` (the hook already returns `profile`).
  - Add to the `formData` initial state and to the `initialData` effect (mirroring how `schoolLevel` is set): `crecheSection: '', healthNotes: '', massarNumber: ''` and a separate `useState<{ name: string; phone: string; relation: string }[]>([])` named `authorizedPickup`, initialized from `initialData?.authorizedPickup || []` in the same effect.
  - Add handlers:

```tsx
    const addPickupPerson = () => setAuthorizedPickup((prev) => [...prev, { name: '', phone: '', relation: '' }]);
    const removePickupPerson = (index: number) => setAuthorizedPickup((prev) => prev.filter((_, i) => i !== index));
    const updatePickupPerson = (index: number, field: 'name' | 'phone' | 'relation', value: string) =>
        setAuthorizedPickup((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
```

  - In `handleSubmit`, build the payload as `{ ...formData, ...(institutionType === 'CRECHE' ? { authorizedPickup } : {}) }` before calling `createStudent`/`updateStudent` (so non-crèche submissions never send an empty `authorizedPickup: []`).
  - Replace the "Scolarité & Contact" card: wrap its current JSX in `{institutionType !== 'CRECHE' && (...)}`, and immediately after it add a new card shown only `{institutionType === 'CRECHE' && (...)}`:

```tsx
                {institutionType === 'CRECHE' && (
                    <div className="group bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 group-hover:w-2 transition-all"></div>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
                                <Users size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Informations de la crèche</h3>
                                <p className="text-sm text-slate-500">Section, santé et personnes autorisées</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-600 ml-1">Section</label>
                                <select
                                    name="crecheSection"
                                    value={(formData as any).crecheSection || ''}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium text-slate-700"
                                >
                                    <option value="">Sélectionner...</option>
                                    <option value="NOURRISSON">Nourrisson</option>
                                    <option value="MOYENNE">Moyenne section</option>
                                    <option value="GRANDE">Grande section</option>
                                </select>
                            </div>

                            {(formData as any).crecheSection === 'GRANDE' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1">Numéro Massar</label>
                                    <Input
                                        name="massarNumber"
                                        value={(formData as any).massarNumber || ''}
                                        onChange={handleChange}
                                        placeholder="Numéro Massar (le cas échéant)"
                                        className="rounded-xl border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50"
                                    />
                                </div>
                            )}

                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-bold text-slate-600 ml-1">Allergies / Notes de santé</label>
                                <textarea
                                    name="healthNotes"
                                    value={(formData as any).healthNotes || ''}
                                    onChange={handleChange as any}
                                    rows={3}
                                    placeholder="Allergies, régime alimentaire, notes de santé"
                                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium text-slate-700"
                                />
                            </div>
                        </div>

                        <div className="mt-8 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-slate-600">Personnes autorisées à récupérer l&apos;enfant</label>
                                <button
                                    type="button"
                                    onClick={addPickupPerson}
                                    className="text-sm font-bold text-emerald-600 hover:text-emerald-700"
                                >
                                    + Ajouter une personne
                                </button>
                            </div>
                            {authorizedPickup.length === 0 && (
                                <p className="text-sm text-slate-400">Aucune personne ajoutée.</p>
                            )}
                            {authorizedPickup.map((person, index) => (
                                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                                    <Input
                                        value={person.name}
                                        onChange={(e) => updatePickupPerson(index, 'name', e.target.value)}
                                        placeholder="Nom"
                                        className="rounded-xl border-slate-200 bg-slate-50/50"
                                    />
                                    <Input
                                        value={person.phone}
                                        onChange={(e) => updatePickupPerson(index, 'phone', e.target.value)}
                                        placeholder="Téléphone"
                                        className="rounded-xl border-slate-200 bg-slate-50/50"
                                    />
                                    <Input
                                        value={person.relation}
                                        onChange={(e) => updatePickupPerson(index, 'relation', e.target.value)}
                                        placeholder="Lien (ex: Tante, Voisine)"
                                        className="rounded-xl border-slate-200 bg-slate-50/50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removePickupPerson(index)}
                                        className="text-sm font-bold text-red-500 hover:text-red-600 justify-self-start"
                                    >
                                        Retirer
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
```

- [ ] **Step 4: Student profile page.** In `app/admin/students/[id]/page.tsx`, after the parent info block (before the closing of the student details card, or as its own card — read the file to place it sensibly), add:

```tsx
                    {(student.crecheSection || student.healthNotes || (student.authorizedPickup && student.authorizedPickup.length > 0)) && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                            <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Crèche</h2>
                            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                                {student.crecheSection && (
                                    <p><span className="text-slate-500">Section : </span>{student.crecheSection}</p>
                                )}
                                {student.massarNumber && (
                                    <p><span className="text-slate-500">Massar : </span>{student.massarNumber}</p>
                                )}
                                {student.healthNotes && (
                                    <p><span className="text-slate-500">Santé : </span>{student.healthNotes}</p>
                                )}
                                {student.authorizedPickup && student.authorizedPickup.length > 0 && (
                                    <div>
                                        <span className="text-slate-500">Personnes autorisées : </span>
                                        <ul className="mt-1 list-disc list-inside">
                                            {student.authorizedPickup.map((p, i) => (
                                                <li key={i}>{p.name} — {p.phone} ({p.relation})</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
```

- [ ] **Step 5: Parent portal.** In `app/p/[token]/page.tsx`, inside each student's card (after the existing due/attendance block), add the same conditional block, adapted to that file's card styling (read it and match its existing className patterns instead of copy-pasting the admin page's dark-mode classes).

- [ ] **Step 6: Verify** — `npx tsc --noEmit` (0 errors) and `npx next build` (must succeed).

- [ ] **Step 7: Commit**

```bash
git add frontend/types/index.ts frontend/components/forms/AddStudentForm.tsx frontend/app/admin/students frontend/app/p
git commit -m "feat(education): crèche-only fields in the enrollment form, profile and parent portal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Manual QA

No code. Start backend + frontend. As an owner of a crèche branch (e.g. the QA crèche school from earlier) and separately as an owner of a private-school branch:
- [ ] Crèche branch: enrollment form shows "Informations de la crèche" and hides "Niveau Scolaire"; selecting "Grande section" reveals the Massar field, other sections hide it; add/remove pickup persons works; submit succeeds; reopening the student for edit pre-fills all crèche fields; the profile page shows the Crèche card.
- [ ] Private-school branch: form is pixel-identical to before (Niveau Scolaire present, no crèche card); creating a student does not send `authorizedPickup`.
- [ ] Parent portal shows the crèche card for a crèche child with data, and nothing extra for a non-crèche child.
- [ ] Backend: full `npx jest` still passes; report actual results.

## Self-Review

**Spec coverage:** schema fields, GRANDE→massar conditional, form swap by `institutionType`, profile/portal display, non-crèche unaffected — all covered by Tasks 1–3. **Placeholders:** none. **Type consistency:** `crecheSection`/`healthNotes`/`authorizedPickup`/`massarNumber` names match across schema, service interfaces, controller, frontend types and the form's field names.
