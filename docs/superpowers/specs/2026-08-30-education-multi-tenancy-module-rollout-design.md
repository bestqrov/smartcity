# Education Multi-Tenancy Module Rollout for ArwaEduc

## Context

The foundation phase (`docs/superpowers/specs/2026-08-29-education-multi-tenancy-design.md`, implemented in `docs/superpowers/plans/2026-08-29-education-multi-tenancy-foundation.md`) added `School`/`Branch` models, the `OWNER` role, `tenantScopeMiddleware`, self-serve signup, and the branch switcher — with `Student` fully retrofitted as the reference module. That plan deliberately added `branchId` as an **optional** scalar field (no relation) to every other tenant-scoped model, so their existing `create()` calls kept working, and deferred actually enforcing it to "a follow-up plan."

This spec is that follow-up: it retrofits the remaining 10 tenant-scoped modules — `Group`, `Teacher`, `Inscription`, `Payment`, `Transaction`, `Pricing`, `Attendance`, `AttendanceNotification`, `Formation`, `Settings` — to the same enforced-scoping pattern `Student` already uses, one module at a time, in a single implementation plan.

`Parent` is explicitly out of scope: it has no `branchId` field and is not planned to get one. A parent's branch membership is derived transitively through their `Student` children (`Parent.students[].branchId`); giving `Parent` its own `branchId` would be redundant and could drift out of sync with the students it's actually linked to.

No production data exists for any school yet (confirmed again for this spec) — no migration tasks are needed, and every model's `branchId` can be tightened straight to `required` as its task retrofits it.

## Goals

- Every one of the 10 modules gets `branchId` scoping enforced the same way `Student` does: routes gated by `tenantScopeMiddleware` (plus `'OWNER'` added to `roleMiddleware`), every read filtered by `req.branchId`, every write's `branchId` taken only from `req.branchId` (never trusted from client payload).
- `branchId` becomes a **required** field (with a real `@relation` to `Branch`) on all 10 models, matching `Student`'s pattern — no model is left with the defensive optional scalar once its task is done.
- Every foreign key from a retrofitted model to another tenant-scoped model is validated to belong to the *same* `branchId` before being accepted on create/update (see "Cross-reference validation" below) — this is the one mechanism `Student` didn't need (it has no outbound FKs to other tenant-scoped models) but every other module does.
- All ten modules are uniformly branch-specific — there are no school-wide exceptions (confirmed for `Formation`, `Pricing`, and `Settings`, which could plausibly have been school-wide but are not, per the business: pricing and course offerings can differ per branch, and each branch keeps its own `Settings` row).

## Non-Goals

- `Parent` retrofitting — out of scope, see Context.
- Any change to `SUPER_ADMIN`'s access — still denied on branch-scoped routes, unchanged from the foundation phase.
- New features on any of the 10 modules — this is a scoping/isolation retrofit only, no behavior or field changes beyond what's needed for tenancy.
- Real cross-branch reporting beyond what `GET /api/branches/summary` already does — not extending that endpoint is in scope here (it already reads `Student`/`Inscription`/`Payment`/`Attendance` opportunistically; once those modules are fully scoped its numbers simply become accurate for retrofitted branches, no code change needed there).

## Rollout Order and Per-Module Notes

Order follows logical dependency (a module that references another is retrofitted after being able to validate against it), with two exceptions accepted deliberately: `Group` goes first even though it references `Teacher` and `Formation` (both retrofitted later), because filtering `Group` by its own `branchId` doesn't require its FK targets to be fully retrofitted yet — only the cross-reference *validation* for those two specific fields does, and that validation is added later, during `Teacher`'s and `Formation`'s own tasks (as a small edit back into `Group`'s service), not deferred as a gap.

| # | Module | `branchId` | Cross-reference validation added |
|---|--------|-----------|-----------------------------------|
| 1 | `Group` | required | `studentIds[]` — every referenced `Student` must share the `Group`'s `branchId`. (`teacherId`/`formationId` validation deferred to tasks 2 and 9.) |
| 2 | `Teacher` | required | None outbound. **Also**: revisit `Group`'s create/update to validate `teacherId` belongs to the same `branchId`. |
| 3 | `Inscription` | required | `studentId` must share the `Inscription`'s `branchId`. |
| 4 | `Payment` | required | `studentId` must share the `Payment`'s `branchId`. |
| 5 | `Transaction` | required | None — no FK to another tenant-scoped model. |
| 6 | `Pricing` | required | None — no FK to another tenant-scoped model. |
| 7 | `Attendance` | required | `studentId` and `groupId` (when present) must share the `Attendance`'s `branchId`. |
| 8 | `AttendanceNotification` | required | Not created from a direct HTTP route — `sendAttendanceNotification` in `notification.service.ts` is called internally (from attendance recording and the absence-job cron), so it has no `req.branchId` to stamp with. Its `branchId` is instead derived by looking up the referenced `Attendance.branchId` and copying it, which doubles as the cross-reference check (an `attendanceId` that doesn't resolve fails the same way). `parentId` is not branch-validated — `Parent` has no `branchId`, see Non-Goals. |
| 9 | `Formation` | required | None outbound. **Also**: revisit `Group`'s create/update to validate `formationId` belongs to the same `branchId`. |
| 10 | `Settings` | required | None. Each branch gets its own `Settings` row; `getSettings`/`upsertSettings` key off `branchId` (via `findFirst`/`upsert` on `branchId`) instead of any fixed/singleton id. |

### Cross-reference validation principle

For any create or update where the request body supplies an id referencing another tenant-scoped model (e.g. `Group.teacherId`, `Attendance.studentId`), the service must look that record up scoped by the *current request's* `branchId` (`findFirst({ where: { id, branchId } })`) rather than trusting the id alone. If the lookup returns nothing, the request is rejected (404/400, matching the existing error style of that module) — the same "never trust a client-supplied id across a tenant boundary" principle `tenantScopeMiddleware` already applies at the request level, applied here at the data-relationship level. `AttendanceNotification` is the one exception to "stamp from `req.branchId`" (see its row in the table above) since it's never created from an HTTP request in the first place.

## Testing

Same TDD pattern used for `Student`: for each module, extend its existing `*.service.test.ts` file with a new `describe('branch scoping', ...)` block (failing tests first, then implementation, then passing) — existing test blocks in that file are preserved untouched. Each module's tests cover: reads filtered by `branchId`, writes stamped with `req.branchId` (not a client-supplied value), and — where applicable — a case proving cross-branch FK references are rejected.

## Final QA

A closing manual QA task (mirroring Task 12 of the foundation plan) re-runs the two-owner isolation scenario end-to-end across the newly-scoped modules: create a `Teacher` and `Group` (with that teacher) in branch A, enroll a student via `Inscription`, record a `Payment` and `Attendance`, then confirm owner B's token is rejected (`403`) against every one of those resources via branch A's id, and that owner A's own access still works. Existing legacy `ADMIN`/`SECRETARY` accounts (`branchId: null`) are re-confirmed to get `403` rather than silently succeeding, same as the foundation plan's QA found for `Student`.
