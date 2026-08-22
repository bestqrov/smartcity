# Education: Attendance (Présence) Module Design

## Goal

Add a third full-stack slice to the Education vertical — attendance tracking per `Group` session,
continuing the pattern established by Guardians and Teachers/Groups. This ports the *concept*
from the user's reference project (`bestqrov/app-injahi`) but not its implementation: app-injahi's
real backend attendance API is a bare `studentId + date + status(present/absent)` model with no
link to a `Group`, and its frontend "Présence" page (a monthly week/session grid) never actually
calls that backend at all — it reads and writes `localStorage` exclusively, so attendance data
never persists server-side in the reference app. Neither is worth copying literally; this design
builds a small, properly persisted, group-based version instead — the user explicitly asked for
"professional improvements that make an educational institution's work easier" on top of the
ported concept, not a literal port of a broken feature.

## Data model

One new Prisma model, tenant-scoped like every other Education model, linked to both `Group` and
`Student`:

```prisma
enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
  EXCUSED
}

model Attendance {
  id        String           @id @default(auto()) @map("_id") @db.ObjectId
  tenantId  String           @db.ObjectId
  groupId   String           @db.ObjectId
  studentId String           @db.ObjectId
  date      DateTime
  status    AttendanceStatus
  notes     String?
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  tenant  Tenant  @relation(fields: [tenantId], references: [id])
  group   Group   @relation(fields: [groupId], references: [id])
  student Student @relation(fields: [studentId], references: [id])

  @@unique([groupId, studentId, date])
  @@map("attendances")
}
```

`Tenant`, `Group`, and `Student` each gain an `attendances Attendance[]` back-reference.

**Four statuses, not app-injahi's two.** PRESENT/ABSENT/LATE/EXCUSED is the improvement the user
asked for — LATE and EXCUSED (justified absence) are standard in real school attendance systems
and materially change what a teacher or admin needs to record. `notes` is optional free text for
the reason behind a LATE/ABSENT/EXCUSED entry.

**`date` is normalized to UTC midnight before every write and read.** The `@@unique([groupId,
studentId, date])` constraint is only meaningful if "one session per group per day" holds — a
`date` value like `2026-08-22T14:37:00Z` and `2026-08-22T09:03:00Z` are different `DateTime`
values in MongoDB and would defeat the constraint if not normalized. The service layer strips the
time component (`new Date(dateString)` → truncate to `YYYY-MM-DDT00:00:00.000Z`) on every write
and query.

## Backend (`education-service`)

New `attendance/` module, structured like `guardians/`'s single-resource shape (no join-table
split needed here, since `Attendance` itself already *is* the join between `Group` and `Student`):

- **`AttendanceService`**:
  - `bulkMark(tenantId, dto)` — validates `groupId` belongs to the tenant; for each entry,
    validates the `studentId` belongs to the tenant **and** is actually enrolled in that group
    (via a `GroupStudent` lookup — reusing the same ownership-check discipline
    `GroupStudentsService` already established) before writing. Uses Prisma's `upsert` on the
    compound unique index (`groupId_studentId_date`) so re-marking the same group+date replaces
    the previous entries rather than erroring or duplicating.
  - `findByGroupAndDate(tenantId, groupId, date)` — returns existing records for a session, used
    to prefill the mark-attendance UI when reopening an already-recorded date.
  - `findByStudent(tenantId, studentId)` — a student's attendance history, newest first, each
    record including its `group` (so the frontend can show which group/subject each entry was
    for).
  - `getGroupStats(tenantId, groupId)` — `{ totalRecords, presentCount, attendanceRate }` where
    `attendanceRate = Math.round((presentCount / totalRecords) * 100)` (0 when `totalRecords` is
    0). Only `PRESENT` counts toward the numerator — `LATE`, `ABSENT`, and `EXCUSED` all count
    against the rate, which matches how attendance rate is conventionally reported.

- **`AttendanceController`** (`@Controller('attendance')`):

```
POST /attendance/bulk        ADMIN, MANAGER, STAFF
GET  /attendance             (any authenticated tenant user) — ?groupId=X&date=Y or ?studentId=X
GET  /attendance/stats/:groupId  (any authenticated tenant user)
```

Registered in `app.module.ts` alongside the existing feature modules. Gateway gets one new route:
`'/api/attendance': educationServiceUrl`.

## Frontend (`education-app`)

- **`src/lib/attendance.ts`** — TanStack Query hooks: `useGroupAttendance(groupId, date)`,
  `useStudentAttendance(studentId)`, `useGroupAttendanceStats(groupId)`,
  `useBulkMarkAttendance()`.
- **New page `src/app/[locale]/(admin)/attendance/page.tsx`** ("Présence" in the sidebar, a new
  cyan accent — every other section already claims sky/primary/amber/violet/rose):
  - Group selector + date picker (defaults to today) at the top.
  - Once both are chosen, loads the group's enrolled students (`useGroupStudents`, already built
    for the Group detail page) and any existing attendance for that group+date
    (`useGroupAttendance`) to prefill.
  - Each student row shows four status buttons (Present/Absent/Late/Excused, color-coded to match
    the `Badge` variants already used for `Student.status` — PRESENT→success, LATE→warning,
    ABSENT→error, EXCUSED→info) plus an optional notes input shown once a non-PRESENT status is
    selected.
  - **"Mark all present" button** above the list — the professional-workflow improvement the user
    asked for: one click sets every row to PRESENT, after which the teacher only has to touch the
    exceptions instead of clicking through every student individually.
  - Save button calls `useBulkMarkAttendance()` with the group, date, and every row's current
    status/notes.
- **Group detail page** (`groups/[id]/page.tsx`) gains a `StatCard` (using `useGroupAttendanceStats`)
  showing the attendance rate, placed above the existing enrolled-students section.
- **Student detail page** (`students/[id]/page.tsx`) gains an "Historique de présence" section
  below the existing Guardians section, listing the student's attendance records
  (`useStudentAttendance`) each with a colored status `Badge`, the date, and which group the
  session was for.
- Sidebar nav gains a "Présence" entry (`Calendar` icon from `lucide-react`, cyan accent),
  positioned after Groups.

## i18n

New `education.*` keys in `en.json`/`fr.json`/`ar.json`: `attendance`, `markAttendance`,
`selectGroupForAttendance`, `selectDate`, `markAllPresent`, `statusPresent`, `statusAbsent`,
`statusLate`, `statusExcused`, `attendanceNotes`, `saveAttendance`, `attendanceRate`,
`attendanceHistory`, `noAttendanceRecordsYet`, `selectGroupAndDatePrompt`.

## Out of scope (explicitly deferred)

- No timetable/scheduled-session concept — attendance is taken for any group+date the user picks,
  not tied to a pre-defined class schedule (module 7, Timetable, doesn't exist in this repo yet).
- No parent notifications on absence (the architecture doc's module 8 flags this as a future
  feature; no notification infrastructure exists in `education-service` today).
- No offline support (the architecture doc flags offline-first as the top *mobile* priority for
  attendance — there is no Education mobile app in this repo yet; this is the web admin panel
  only).
- No CSV/PDF export (app-injahi's presence page has `Printer`/`Download` icons that aren't wired
  to anything functional either — not a real feature to port).

## Testing

Same as every prior Education slice: no test harness exists anywhere in this repo. Verification
is `tsc --noEmit`, `nest build`, and manual `curl` + Playwright checks before merging.
