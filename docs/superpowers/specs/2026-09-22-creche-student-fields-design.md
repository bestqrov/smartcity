# Crèche-Specific Student Fields

## Context

The enrollment form (`AddStudentForm`) and the `Student` model are shared by every institution type. A crèche does not need `schoolLevel`/`currentSchool`, and it needs fields no other type does: an age group, health notes, and a list of people authorized to pick the child up. `School.institutionType` (added for packs) already tells the frontend and backend which type a branch's school is.

## Goals

- `Student` gains three optional fields, used only when the branch's school is a crèche: `crecheSection` (`NOURRISSON` | `MOYENNE` | `GRANDE`), `healthNotes` (free text), `authorizedPickup` (list of `{ name, phone, relation }`).
- `GRANDE` additionally shows a `massarNumber` free-text field (closest to formal schooling, may already have one).
- The enrollment form shows a **crèche-only card** replacing `schoolLevel`/`currentSchool` when the school's `institutionType` is `CRECHE`; the massar field appears only when the section is `GRANDE`. Other institution types see the form exactly as today.
- The student profile page and the parent portal show these fields (read-only) when present.

## Non-Goals

Enforcing the fields as required, validating phone/relation formats, a dedicated "authorized pickup" verification flow (e.g. checking an ID at pickup, QR), health-file uploads, editing pickup persons from the parent portal, any change to non-crèche student data or forms.

## Data Model

Add to `model Student` (all optional, no default, no migration needed on MongoDB):

```prisma
  crecheSection    String? // NOURRISSON | MOYENNE | GRANDE — crèche only
  healthNotes      String? // allergies / health notes — crèche only
  authorizedPickup Json?   // [{ name: string, phone: string, relation: string }] — crèche only
  massarNumber     String? // set only when crecheSection = GRANDE
```

`authorizedPickup` is `Json` (not a relation): the list is short (2–4 people) and never queried independently, so a relation would add a model and joins for no benefit.

## Backend

`students.service.ts` `CreateStudentData`/`UpdateStudentData` gain the four fields (all optional passthrough, same pattern as `schoolLevel`). `students.controller.ts` `create`/`update` destructure and forward them exactly like the existing optional fields (`if (x) studentData.x = x;`). No new validation beyond "must be a string" for `crecheSection`/`healthNotes`/`massarNumber` and "must be an array" for `authorizedPickup` — the frontend only ever sends the crèche shape, and other institution types never send these fields.

## Frontend

`AddStudentForm.tsx`: reads `institutionType` from `useSchoolProfile()` (already available). When `institutionType === 'CRECHE'`, the "Scolarité & Contact" card is replaced by a **"Informations de la crèche"** card:
- `crecheSection`: a 3-option select (Nourrisson / Moyenne section / Grande section).
- `healthNotes`: a textarea ("Allergies, régime alimentaire, notes de santé").
- `authorizedPickup`: a repeatable row list (name, phone, relation), "+ Ajouter une personne" / remove button, starts empty.
- `massarNumber`: a text input, shown only when `crecheSection === 'GRANDE'`.

For every other institution type, the form is unchanged (still shows `schoolLevel`/`currentSchool`). `StudentFormData` and the `Student` type gain the four optional fields.

The student profile page (`app/admin/students/[id]/page.tsx`) shows a "Crèche" card with these fields when any of them is set, regardless of the viewer's own institution type (so data entered while the branch was a crèche stays visible). The parent portal shows the same fields read-only in the child's card, when present.

## Testing

Backend: extend `students.service.test.ts` with a case that create/update pass the four fields through untouched when given, and are absent from the created record when omitted (matches the existing `schoolLevel` test pattern). Frontend: `tsc --noEmit` and `next build`; manual QA — a crèche branch shows the crèche card and hides Niveau Scolaire, a private-school branch is unchanged, the massar field only appears for Grande section, and the fields round-trip (save → reopen the edit form → values are pre-filled).
