# Education: importing students from Excel

**Date:** 2026-11-12
**App:** ArwaEduc (`apps/education-apps`)
**Status:** design approved, ready for the implementation plan

## Problem

Schools that sign up usually do so in the middle of the academic year. Their students
are already enrolled and listed in Excel files. The only way to add students today is
the inscription form, one student at a time. For a school with 300 to 800 students,
that is days of data entry, and the sales team reports it as a blocker.

## Goal

An admin can upload the school's existing Excel file and get every student created in
ArwaEduc, placed in the right group, within minutes.

Success means:
- A file of 500 rows goes from upload to created students in under 5 minutes of the
  admin's time.
- A file whose columns do not match our names can still be imported, by mapping its
  columns by hand.
- Importing the same file twice does not create duplicate students.
- Bad rows never block good rows, and the admin gets the bad rows back as an Excel file
  to fix and re-upload.

## Scope

**In scope:**
- Students, with their parent contact fields and school fields.
- Assignment to an existing group.
- Optionally creating the groups that the file names but that do not exist yet.
- The institution types that use `SoutienInscriptionForm` or `AddStudentForm`:
  private schools, tutoring centers, language centers and crèches.

**Out of scope for this phase:**
- **Past payments and balances.** These are kept in inconsistent formats in schools'
  files, and importing them dated today would show a large fake revenue spike in the
  analytics on the import day. The admin records future payments in the app as usual.
- **Inscription records and fees.** Imported students get no `Inscription` and no
  `Payment` row.
- **Vocational training (Formation Pro).** Its enrollment logic is different.
- **Transport subscriptions.**
- **Pack features** (`Pack.features`, for example TRANSPORT). Like the student limit,
  they are not enforced anywhere yet. Enforcing them is a separate piece of work.
- **Automatic recognition of the Massar export format.** Manual column mapping works
  with a Massar file. Auto-detection will be added once we have a real Massar file to
  build it against.

## Pack student limit

The import makes it possible to add hundreds of students in a minute, so it must respect
the school's pack. Today `Pack.maxStudents` is shown on the pricing page but is not
enforced anywhere. This work enforces it **for every way a student is created**, not
only for the import. Otherwise a school could get around the limit one student at a
time, and the two paths would disagree.

**The rule**
- The limit applies to the whole school, across all its branches: the packs are sold
  per school, and `maxBranches` sits next to `maxStudents` on the same pack.
- Only active students count (`Student.active = true`). There is no deactivate action
  in the app today, so in practice every student counts. Deleting a student frees a
  place.
- `maxStudents = null` (Premium, Crèche Plus) means no limit.
- A school with no pack has no limit. Signup gives every school its type's default pack
  when one exists, so this only covers old data.
- The limit applies during the trial as well. A school on trial that needs more places
  is moved to a bigger pack by the platform admin (`assignPackToSchool`). This is also
  the upsell moment for the sales team.

**Shared check:** `assertStudentCapacity(branchId, adding)` in a new
`src/modules/packs/packs.limits.ts`.
- It finds the branch's school and pack, counts the active students in all of the
  school's branches, and throws `STUDENT_LIMIT_REACHED` when `count + adding > maxStudents`.
- The error carries `{ limit, current, adding }`, so the frontend can show the numbers.
- The controllers turn it into HTTP 403 with code `STUDENT_LIMIT_REACHED`.

**Where it is called**
- `POST /students`, with `adding = 1`. This covers the Soutien, crèche and Formation
  forms, since they all create students through it.
- The import's `validate`, with `adding` = the number of valid rows. This returns
  `capacity: { limit, current, remaining }` in the response instead of throwing, so the
  preview can show it.
- The import's `commit`, with `adding` = the number of valid rows. This is checked
  once, before anything is written.

**When the file has more valid rows than places left**
- The commit is refused as a whole. Importing only the first N rows would pick, at
  random, which students exist in the app.
- The preview shows a red banner before the admin confirms: *"Votre pack « Pro » permet
  300 élèves. Vous en avez 120, ce fichier en ajoute 250 : il manque 70 places. Retirez
  des lignes du fichier ou passez à un pack supérieur."* The confirm button is disabled.
- The single-student forms show the same message when `POST /students` returns
  `STUDENT_LIMIT_REACHED`.

**Known gap.** The count and the inserts are not atomic. Two imports running at the same
moment in the same school could overshoot the limit slightly. This is accepted: it
needs two people importing at once, and the overshoot is bounded by one file.

## Approach

The browser reads the Excel file, and the server receives the rows as JSON.

- Reading in the browser gives the admin an instant preview and avoids adding file
  upload handling (multer) to the backend.
- The server does not trust the browser. It validates and normalises every row again.

The two other options were rejected:
- **Uploading the file and parsing it on the server.** This needs multer and a server
  spreadsheet library, and the preview would need an extra round trip.
- **CSV only.** Admins would have to convert their files themselves, which is a common
  point of failure.

## User flow

A new page, **"Importer depuis Excel"**, at `/admin/inscriptions/import` and
`/secretary/inscriptions/import`. A button on the existing Inscriptions pages links to
it.

1. **Download the template.** This is an `.xlsx` file generated in the browser. It has
   one column per supported field, with French headers and Arabic hints, and one
   example row.
2. **Upload a file.** The page accepts `.xlsx`, `.xls` and `.csv`, and reads the first
   sheet. The first non-empty row is the header row.
3. **Map the columns.** Each column in the file is matched automatically to a field
   using a list of known header names (see "Header synonyms"). The admin can change any
   match or set a column to "Ignorer". Each field can be mapped from only one column.
   - The full-name option, "Nom complet", splits the value into a surname (the first
     word) and a name (the rest). The admin sees the result in the preview.
   - The page does not move on until either "Nom" and "Prénom" are both mapped, or
     "Nom complet" is mapped.
4. **Preview.** The page sends the mapped rows to the server in validate-only mode, then
   shows every row with its status:
   - **Valide** (green): the row will be created.
   - **Doublon** (orange): the student already exists in this branch, or appears earlier
     in the same file. The row is skipped.
   - **Erreur** (red): the row breaks a rule, and the reason is shown. The row is
     skipped.
   - The page lists the groups that the file names but that do not exist yet, with a
     checkbox, unchecked by default: **"Créer ces groupes automatiquement"**. If the box
     stays unchecked, those students are created without a group, and their rows show a
     warning rather than an error.
   - Summary counters, and a filter by status.
5. **Confirm.** The server creates the valid rows.
6. **Report.** The page shows the counts created, skipped as duplicates, and in error.
   A button, **"Télécharger les lignes en erreur"**, downloads an `.xlsx` file with the
   original columns of the error rows plus an "Erreur" column.

## Supported fields

| Field | Student column | Rules |
|---|---|---|
| Nom | `surname` | required, trimmed, at most 100 characters |
| Prénom | `name` | required, trimmed, at most 100 characters |
| Nom complet | splits into `surname` and `name` | alternative to the two above |
| Date de naissance | `birthDate` | `dd/mm/yyyy`, `dd-mm-yyyy`, `yyyy-mm-dd`, or an Excel date serial. Must be between 1950 and today. An invalid date is an error. |
| Lieu de naissance | `birthPlace` | text |
| Niveau | `schoolLevel` | free text, stored as given |
| Groupe / Classe | the student's `groupIds` | matched by name (see "Groups") |
| École actuelle | `currentSchool` | text |
| Code Massar | `massarNumber` | trimmed and uppercased |
| CIN | `cin` | trimmed and uppercased |
| Adresse | `address` | text |
| Téléphone élève | `phone` | normalised (see "Phone numbers") |
| Email | `email` | must contain `@` if given |
| Nom du père | `fatherName` | text |
| Nom de la mère | `motherName` | text |
| Nom du tuteur | `parentName` | text |
| Lien de parenté | `parentRelation` | text |
| Téléphone tuteur | `parentPhone` | normalised |
| Section crèche | `crecheSection` | text, shown only for crèches |
| Notes de santé | `healthNotes` | text, shown only for crèches |

- Empty cells are left unset.
- Every text value is trimmed, and any text value longer than 500 characters is an
  error.

**Phone numbers.** Spaces, dots and dashes are removed. The forms `+2126…`, `002126…`
and `2126…` become `06…`, and the same applies to 5 and 7. A number that is still not
10 digits starting with 05, 06 or 07 is kept as typed and shows a warning, not an
error, since some schools have foreign parents.

## Header synonyms

Headers are matched after lowercasing, removing accents and punctuation, and collapsing
spaces. Examples of known headers for each field:

- Nom: `nom`, `nom eleve`, `family name`, `النسب`, `الإسم العائلي`
- Prénom: `prenom`, `prenom eleve`, `first name`, `الاسم`, `الإسم الشخصي`
- Nom complet: `nom et prenom`, `nom complet`, `eleve`, `الاسم الكامل`
- Date de naissance: `date de naissance`, `date naissance`, `ddn`, `né le`, `تاريخ الازدياد`
- Code Massar: `code massar`, `massar`, `cne`, `رمز مسار`
- Téléphone tuteur: `tel parent`, `telephone parent`, `gsm parent`, `tel tuteur`, `هاتف الولي`
- Groupe / Classe: `classe`, `groupe`, `class`, `القسم`, `الفوج`

The full list lives in one frontend module, so it can grow as schools send us files.

## Duplicates

A row is a duplicate when one of these is true:
- Its Massar code matches a student in the branch, or a row earlier in the file.
- It has no Massar code, and its surname, name and birth date match an existing student
  or an earlier row. Names are compared case- and accent-insensitively.

A row with no Massar code and no birth date is never treated as a duplicate, since
there is no safe key. Two students can have the same name.

## Groups

- The value in "Groupe / Classe" is matched case-insensitively and trimmed against the
  names of the branch's groups.
- If the box "Créer ces groupes automatiquement" is checked, each missing name is
  created once, before the students. The new group has `type: SOUTIEN` and takes its
  `level` from the first row that names it, if that row has a Niveau.
- A group created this way has no teacher, no subject and no time slots. The admin fills
  these in from the Groups page.

## Backend

A new module, `src/modules/students-import/`, with its routes mounted under
`/students/import`, and the same middleware chain as `POST /students`: auth, role
`ADMIN | SECRETARY | OWNER`, then tenant scope. The `branchId` always comes from
`req.branchId`.

**`POST /students/import/validate`**
- Body: `{ rows: ImportRow[] }`, where each `ImportRow` has the field keys above as
  strings, plus `rowNumber`.
- Writes nothing.
- Returns, for each row, `{ rowNumber, status: 'valid' | 'duplicate' | 'error', errors: string[], warnings: string[] }`,
  together with `missingGroups: string[]` and
  `capacity: { limit: number | null, current: number, remaining: number | null }`.

**`POST /students/import/commit`**
- Body: `{ rows: ImportRow[], createMissingGroups: boolean }`.
- Runs the same validation again. It does not reuse the result of the validate call,
  because the data may have changed in between.
- Creates any missing groups that were requested, then creates the valid students in
  chunks of 50. Each student is created with fresh access and portal token hashes, the
  same way `createStudent` does, but with no `Inscription` and no `Payment`.
- A failure while creating one row is recorded as an error for that row, and the import
  continues with the next row.
- Returns the per-row results and the counts.

**Limits**
- At most 1000 rows per request. Anything more returns 400 with a message telling the
  admin to split the file.
- The JSON body limit is raised for these two routes only, if the current limit is
  smaller than what 1000 rows need.
- Both routes are behind the existing trial-expiry write block in `tenantScope`. That
  block applies to `commit`. `validate` is a POST but writes nothing, and it is fine for
  it to be blocked too.

**Code layout**
- `normalize.ts`: pure functions for dates, phones, names, the full-name split, and
  duplicate keys.
- `importStudents.service.ts`: validation against the database, duplicate detection,
  group resolution, and creation.
- The controller and routes.
- The pure functions do not depend on Prisma, so they can be tested without a database.

## Frontend

- **Spreadsheet library:** SheetJS (`xlsx`), installed from the official SheetJS CDN
  tarball (0.20.x). The npm registry copy (0.18.5) has known vulnerabilities and is no
  longer maintained there.
- **Lazy loading:** the library is loaded with a dynamic import on the import page only,
  so other pages do not grow.
- **Components:**
  - `frontend/app/admin/inscriptions/import/page.tsx`, with the secretary page reusing
    the same component.
  - `frontend/components/import/StudentImportWizard.tsx` for the four steps.
  - `frontend/lib/import/headerSynonyms.ts`
  - `frontend/lib/import/readSheet.ts` for reading a file into a header and rows.
  - `frontend/lib/import/template.ts` for generating the template and the error file.
  - `frontend/lib/services/studentsImport.ts` for the API calls.
- **Phone layout:** the preview table switches to cards at phone width, following the
  same pattern as the agents list.

## Testing

**Backend (jest), pure functions:**
- Every date format, including Excel serials, out-of-range years and invalid dates.
- Every phone form.
- Splitting a full name.
- The duplicate key, including accents and letter case.

**Backend (jest), service, using the existing test style:**
- Branch isolation: duplicates and groups are only looked up in the caller's branch.
- Duplicates within the file and against the database.
- Group matching and creation, when requested and when not.
- The 1000-row limit.
- No `Inscription` and no `Payment` created.
- One failing row does not stop the others.
- Pack limit: a commit over the limit writes nothing; a commit exactly at the limit
  succeeds; `validate` reports the capacity.

**Backend (jest), `assertStudentCapacity`:**
- It counts across all branches of the school and ignores other schools.
- It ignores inactive students.
- A `null` limit and a school with no pack are unlimited.
- `POST /students` returns 403 `STUDENT_LIMIT_REACHED` when the school is full.

**Frontend:**
- Header matching against a set of real-looking headers in French, Arabic and mixed
  case.

**Manual check on localhost:3011:**
- Import the template with 20 rows, including duplicates, errors and a missing group.
- Import it again and check that it creates nothing new.
