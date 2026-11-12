# Education: grades and evaluations (project B)

**Date:** 2026-11-12
**App:** ArwaEduc (`apps/education-apps`)
**Roadmap:** B of A–D. A (the parent space, `/p/[token]`) is merged. Grades appear there as a new tab.

## Problem

Parents most want to follow their child's grades, and competitors show them. ArwaEduc has no grades at all. Teachers also have no access to the app: the `Teacher` model is a staff and payroll record with no login.

## Goal

1. Teachers enter grades quickly, even on a phone, without managing a password.
2. Staff can do the same, and control what parents see.
3. Parents see published grades and averages per subject and per period, in the parent space.

## Decisions

- **Teacher access is a secret link (`/t/<token>`), not a password account.** It is the same model as the parent and student portals:
  - only the token hash is stored;
  - staff create the link and send it by WhatsApp from the teacher's page;
  - regenerating it kills the old one.
  - This avoids a new user role, logins and password resets. Teachers can start in seconds.
- **A teacher sees and grades only the groups where `Group.teacherId` is them**, in their branch.
- **Periods** are a per-branch list of names in `Settings.gradingPeriods String[]`. The default is `["Semestre 1", "Semestre 2"]`. A school can switch to trimesters or anything else from the settings page.
- **Scores** are any number from 0 to `maxScore`; the default `maxScore` is 20. Averages are normalised to /20 and weighted by `coefficient`.
- **Only published evaluations reach parents.** A teacher or staff member publishes an evaluation once its grades are entered. Unpublishing hides it again.

## Data

```prisma
model Evaluation {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  branchId    String   @db.ObjectId
  groupId     String   @db.ObjectId
  title       String          // "Contrôle 1", "Examen"
  subject     String          // defaults to the group's subject (or group name)
  period      String          // one of Settings.gradingPeriods
  date        DateTime
  maxScore    Float    @default(20)
  coefficient Float    @default(1)
  published   Boolean  @default(false)
  createdBy   String?         // "teacher:<id>" or "user:<id>"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  grades      Grade[]
  @@index([branchId, groupId, period])
  @@map("evaluations")
}

model Grade {
  id           String     @id @default(auto()) @map("_id") @db.ObjectId
  branchId     String     @db.ObjectId
  evaluationId String     @db.ObjectId
  evaluation   Evaluation @relation(fields: [evaluationId], references: [id], onDelete: Cascade)
  studentId    String     @db.ObjectId
  score        Float?     // null = not entered yet
  absent       Boolean    @default(false)
  comment      String?
  updatedAt    DateTime   @updatedAt
  @@unique([evaluationId, studentId])
  @@index([studentId])
  @@map("grades")
}
```

Plus three changes to existing models:
- `Teacher.accessTokenHash String? @unique` and `Teacher.linkIssuedAt DateTime?`.
- `Settings.gradingPeriods String[]`. An empty list means the default is used.
- `Evaluation.groupId` and `Grade.studentId` are plain ids. Every service checks that they belong to the branch.

## Rules

**Evaluations**
- An evaluation needs:
  - a title (1–100 characters);
  - a period from the branch's list;
  - a date;
  - `maxScore` between 1 and 100;
  - `coefficient` between 0.1 and 10.

**Saving grades**
- Grades are saved in one batch per evaluation: `[{ studentId, score|null, absent, comment? }]`.
- Every student must be a current member of the group.
- A score must be between 0 and `maxScore`.
- `absent: true` forces `score: null`.
- The save is an upsert per student, in one transaction.

**Averages and changes**
- A subject average for a period is `Σ(score/maxScore*20 × coef) / Σ(coef)` over the student's published, non-absent, scored grades.
- The general average for a period is the plain mean of that period's subject averages. Rounding happens only for display, to 2 decimals.
- Deleting an evaluation deletes its grades.
- Editing `maxScore` below an existing score is refused.

## Teacher space (`/t/[token]`)

- Mobile-first, French, with dark mode and the same visual language as the parent space.
- **Home:** the teacher's groups as cards: name, subject, level, number of students and number of evaluations.
- **Group:** its evaluations, newest first, each with a published/draft badge, the number of grades entered out of the number of students, and the class average. A "Nouvelle évaluation" button opens a form: title, period (default: the last used), date (default: today), `maxScore`, coefficient.
- **Grade entry:**
  - One row per student, sorted by surname: a large numeric input, an "Absent" toggle and an optional comment.
  - Grades autosave about 1 second after typing stops, with a "Enregistré" indicator. The batch endpoint is used, and the screen offers "Saisir tout absent / effacer".
  - The keyboard is numeric (`inputMode="decimal"`), and a comma is accepted as the decimal separator.
  - "Publier pour les parents" asks for confirmation when grades are missing, then publishes.
- **Errors:** a bad link shows "Lien invalide, demandez un nouveau lien à l'établissement".

## Staff side

**`/admin/grades`, titled "Notes"** (with a sidebar entry; the secretary gets it too)
- Pick a group, then use the same evaluation list and grade entry as the teacher. The components are shared.
- A **bulletin** view per group and period:
  - students as rows;
  - one column per subject with its average;
  - the general average;
  - the rank;
  - "Exporter Excel" (SheetJS is already installed).

**Teacher links**
- On the teachers page, each teacher gets "Lien enseignant": create or regenerate, show the link and a QR, and send by WhatsApp. This reuses `PortalLinkCard`.
- The teacher's `linkIssuedAt` is shown.

**Settings**
- The settings page gets "Périodes de notation". These are editable chips, with the presets "Semestres" (2) and "Trimestres" (3).

**Crèche**
- Grades are hidden in crèche mode: the sidebar entry is hidden, and the parent tab is not shown.

## Parent space (`/p/[token]`)

- **A new "Notes" tab** in the bottom bar, which grows from 4 to 5 tabs. It shows:
  - a period switcher;
  - the general average as a large figure;
  - one card per subject with its average and its evaluations (title, date, score/max, coefficient, comment, "Absent").
- **Home tab:** a "Dernières notes" card shows the latest 3 published grades.
- **Language:** French and Arabic strings in `lib/parent/messages.ts`.
- **Data:** published evaluations only, through the existing profile endpoint, which gets a `grades` list per child and the branch's `gradingPeriods`.

## API

**Teacher (public, token, rate-limited like the parent profile)**
- `GET /teacher-portal/:token`: the teacher, their groups with students (id, name, surname), the periods, and the evaluations with grades.
- `POST /teacher-portal/:token/evaluations`, `PUT …/evaluations/:id`, `DELETE …/evaluations/:id`.
- `PUT …/evaluations/:id/grades`: the batch.
- `POST …/evaluations/:id/publish` with `{ published }`.
- Every call resolves the teacher from the token and checks that the group's `teacherId` is that teacher.

**Staff (ADMIN, SECRETARY, OWNER, tenant-scoped)**
- The same operations under `/grades/...`, for any group of the branch.
- `GET /grades/bulletin?groupId&period`.
- `POST /teachers/:id/portal-link`, which returns `{ rawToken }`.
- `GET` and `PUT /settings` handle `gradingPeriods`.

## Testing

**Jest, prisma mocked:**
- the average formula, including absent, unscored and unpublished grades and different `maxScore` values;
- every validation rule;
- a teacher cannot touch another teacher's group or another branch;
- batch upsert;
- publish and unpublish;
- the parent profile shows only published grades.

**Frontend:** `tsc`, plus a manual check on localhost of the teacher link on a phone width, the staff grades page, the bulletin export, and the parent Notes tab in French and Arabic.

## Out of scope

- Report-card PDFs with official layouts.
- Exam timetables.
- Notifying parents of new grades: there is no real WhatsApp or SMS channel yet.
- Teacher accounts with passwords.
