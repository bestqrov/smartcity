# Grades and evaluations: implementation plan (project B)

> Executed with superpowers:subagent-driven-development. The spec is the source of truth:
> `docs/superpowers/specs/2026-11-12-education-grades-design.md`.

**Branch:** `feat/education-grades`. Backend tasks are TDD (jest, prisma mocked). For frontend tasks, run `npx tsc --noEmit` and do not run `npm run build`, because the dev server is running on port 3011.

## Task 1: Schema and the grades domain service

1. Schema changes:
   - add the models `Evaluation` and `Grade`;
   - add `Teacher.accessTokenHash String? @unique` and `Teacher.linkIssuedAt DateTime?`;
   - add `Settings.gradingPeriods String[]`.

   Then run `npx prisma validate && npx prisma generate && npx prisma db push`.
2. Create `src/modules/grades/grades.math.ts`, which holds only pure functions:
   - `normalize(score, max)`;
   - `subjectAverages(evals with grades, studentId)`;
   - `generalAverage`;
   - `rankStudents`.
3. Create `src/modules/grades/grades.service.ts`, built around one scope parameter, `scope = { branchId, teacherId?: string }`. The scoped functions are:
   - `listGroupEvaluations`, `createEvaluation`, `updateEvaluation`, `deleteEvaluation`, `saveGrades`, `setPublished`;
   - `bulletin(groupId, period)`;
   - `periodsFor(branchId)`, which returns the defaults when the list is empty.

   Every function checks that the group belongs to `branchId`, and also to `teacherId` when that is set. It also checks that every student belongs to the group.
4. Write tests for every rule in the spec.

## Task 2: Routes

1. Staff routes:
   - `src/modules/grades/grades.routes.ts` serves `/api/grades/...`, with auth, the roles ADMIN, SECRETARY and OWNER, and tenantScope.
   - Add `POST /api/teachers/:id/portal-link`.
   - Make the settings service and controller accept `gradingPeriods`: an array of 1 to 6 distinct, non-empty names, each at most 30 characters.
2. Teacher routes:
   - `src/modules/teacher-portal/` serves `/api/teacher-portal/:token/...`.
   - Use the rate limiter, resolve the teacher by the hash of the token, then call the grades service with `{ branchId: teacher.branchId, teacherId: teacher.id }`.
   - A bad token returns 404.
3. Extend the parent profile (`getParentByRawToken`): give each child `grades` drawn only from published evaluations, shaped `[{ evaluationId, title, subject, period, date, maxScore, coefficient, score, absent, comment }]`. Add the branch's `gradingPeriods` at the top level.
4. Write the tests.

## Task 3: Shared grade UI and the teacher space

1. Create `frontend/lib/services/grades.ts`, a client that works either with a staff `api` or with a teacher token. One interface, two implementations.
2. Create `frontend/components/grades/`:
   - `EvaluationList`, `EvaluationForm`, `GradeEntry` (with autosave, a numeric keyboard and a comma as the decimal separator), and `PublishButton`;
   - every component takes the client as a prop.
3. Create `frontend/app/t/[token]/page.tsx`, plus `layout.tsx` for its metadata. It shows the teacher's groups, then a group's evaluations, then grade entry. It is mobile first and supports dark mode.

## Task 4: Staff pages

1. Create `frontend/app/admin/grades/page.tsx` and its secretary twin. It has a group picker and uses the shared components.
2. Add a "Bulletin" tab: a table per period with subject averages, the general average and the rank, and an "Exporter Excel" button.
3. On the teachers page, add a "Lien enseignant" action that calls the portal-link route and shows `PortalLinkCard`. Show `linkIssuedAt`.
4. On the settings page, add the "Périodes de notation" editor with the Semestres and Trimestres presets.
5. In the sidebar, add "Notes" for admin and secretary, hidden in crèche mode.

## Task 5: Parent space

1. Add a "Notes" tab (`GradesTab`) and a "Dernières notes" card on the Home tab.
2. Add the French and Arabic strings to `lib/parent/messages.ts`.
3. Hide all of this when the child has no grades and the school is a crèche.
4. Extend the types.

## Task 6: Review, then demo data and a manual check
