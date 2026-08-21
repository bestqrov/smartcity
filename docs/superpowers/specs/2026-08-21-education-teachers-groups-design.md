# Education: Teachers & Groups Module Design

## Goal

Add a second full-stack slice to the Education vertical — Teachers and Groups — following the
exact pattern established by the Guardians module (`services/education-service/src/guardians/`,
`apps/education-app/src/lib/guardians.ts` + `guardians/page.tsx`). This is the first piece of
"Phase 2" (Academic Structure) from `docs/education/architecture/00-reconciliation-baseline.md`
§5 and module 5/6 of `docs/education/architecture/05-module-specifications.md`, scoped down to
match the user's other project (`bestqrov/app-injahi`)'s actual, simpler implementation rather
than the architecture doc's fuller Program/Subject/Level ambition — the same kind of deliberate
scope-down `docs/superpowers/plans/2026-08-11-education-service-foundation.md` did for Phase 1.

## Data model

Three new Prisma models in `packages/database/prisma/schema.prisma`, all `tenantId`-scoped like
every other Education model:

```prisma
enum PaymentType {
  HOURLY
  FIXED
  PERCENTAGE
}

model Teacher {
  id          String      @id @default(auto()) @map("_id") @db.ObjectId
  tenantId    String      @db.ObjectId
  firstName   String
  lastName    String
  email       String?
  phone       String?
  specialties String[]
  levels      String[]
  hourlyRate  Float       @default(0)
  paymentType PaymentType @default(HOURLY)
  isActive    Boolean     @default(true)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  tenant Tenant  @relation(fields: [tenantId], references: [id])
  groups Group[]

  @@map("teachers")
}

model Group {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId  String   @db.ObjectId
  branchId  String   @db.ObjectId
  name      String
  level     String?
  subject   String?
  room      String?
  teacherId String?  @db.ObjectId
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant   Tenant         @relation(fields: [tenantId], references: [id])
  branch   Branch         @relation(fields: [branchId], references: [id])
  teacher  Teacher?       @relation(fields: [teacherId], references: [id])
  students GroupStudent[]

  @@map("groups")
}

model GroupStudent {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  tenantId  String   @db.ObjectId
  groupId   String   @db.ObjectId
  studentId String   @db.ObjectId
  createdAt DateTime @default(now())

  tenant  Tenant  @relation(fields: [tenantId], references: [id])
  group   Group   @relation(fields: [groupId], references: [id])
  student Student @relation(fields: [studentId], references: [id])

  @@unique([groupId, studentId])
  @@map("group_students")
}
```

`Branch` and `Student` gain back-reference fields (`groups Group[]`, `groupLinks GroupStudent[]`),
and `Tenant` gains `teachers Teacher[]`, `groups Group[]`, `groupStudents GroupStudent[]` —
mirroring exactly how Guardian/StudentGuardian were wired onto `Tenant`/`Student` in Phase 1.

`teacherId` on `Group` is optional (matching `app-injahi`'s actual `Group.teacherId Teacher?`),
not the stricter "no group without an assigned teacher" rule module 6 of the architecture doc
proposes — same kind of pragmatic deviation Phase 1 documented for `SubscriptionGuard`.

## Backend (`education-service`)

Two new modules, structured exactly like `branches/` and `guardians/`:

- **`src/teachers/`**: `teachers.module.ts`, `teachers.controller.ts`, `teachers.service.ts`,
  `dto/create-teacher.dto.ts`, `dto/update-teacher.dto.ts`. Standard tenant-scoped CRUD
  (`create`/`findAll`/`findById`/`update`/`deactivate`), same shape as `BranchesService`.
- **`src/groups/`**: `groups.module.ts`, `groups.controller.ts`, `groups.service.ts`,
  `group-students.controller.ts`, `group-students.service.ts`, plus DTOs for both. Mirrors
  `guardians/guardians.service.ts` + `guardians/student-guardians.service.ts` exactly:
  - `GroupsService`: CRUD on `Group`. `create`/`update` validate `branchId` belongs to the tenant
    (reusing the same `assertBranchInTenant`-style check `StudentsService` already has) and, if
    `teacherId` is given, that the teacher belongs to the tenant too.
  - `GroupStudentsService`: `enroll(tenantId, groupId, studentId)` validates both belong to the
    tenant before creating the join row (`ConflictException` on duplicate pair, matching
    `StudentGuardiansService`'s pattern); `remove(tenantId, id)`; `findByGroup(tenantId, groupId)`
    returns enrolled students.

Endpoints:

```
POST   /teachers            ADMIN, MANAGER
GET    /teachers            (any authenticated tenant user)
GET    /teachers/:id
PATCH  /teachers/:id        ADMIN, MANAGER
DELETE /teachers/:id        ADMIN, MANAGER   (deactivate, not hard delete)

POST   /groups              ADMIN, MANAGER
GET    /groups
GET    /groups/:id
PATCH  /groups/:id          ADMIN, MANAGER
DELETE /groups/:id          ADMIN, MANAGER

GET    /groups/:id/students
POST   /group-students      ADMIN, MANAGER, STAFF
DELETE /group-students/:id  ADMIN, MANAGER, STAFF
```

Both new modules get registered in `app.module.ts`, and `/teachers`, `/groups`, `/group-students`
get added to the gateway's route map (`services/gateway/src/proxy/proxy.middleware.ts`), the same
two-line additions Phase 1 made for `/branches` and `/students`.

## Frontend (`education-app`)

Two new sidebar sections in the `(admin)` layout, following the existing color-coded pattern
(`Teachers` → violet accent, `Groups` → rose accent, keeping `Building2`/`GraduationCap`/`Users`
for the existing three and adding `Presentation` for Teachers, `Layers` for Groups from
`lucide-react`, which is already a dependency after the login/sidebar redesign).

- `src/lib/teachers.ts`, `src/lib/groups.ts`, `src/lib/group-students.ts` — TanStack Query hooks,
  copied structurally from `src/lib/guardians.ts` / `src/lib/student-guardians.ts`.
- `src/app/[locale]/(admin)/teachers/page.tsx` — list + create form, styled like
  `branches/page.tsx`.
- `src/app/[locale]/(admin)/groups/page.tsx` — list + create form.
- `src/app/[locale]/(admin)/groups/[id]/page.tsx` — group detail: shows the group's teacher/room/
  level/subject, its enrolled students, and a form to enroll an existing student by picking from
  a dropdown of the tenant's students (mirrors `students/[id]/page.tsx`'s existing guardian-linking
  UI, which already does student→guardian enrollment the same way).

## i18n

New `education.*` keys in `en.json`/`fr.json`/`ar.json`: `teachers`, `addTeacher`, `teacherFirstName`,
`teacherLastName`, `teacherEmail`, `teacherPhone`, `teacherSpecialties`, `teacherLevels`,
`teacherHourlyRate`, `noTeachersYet`; `groups`, `addGroup`, `groupName`, `groupLevel`,
`groupSubject`, `groupRoom`, `groupTeacher`, `noGroupsYet`, `enrollStudent`.

## Out of scope (explicitly deferred, same as the architecture doc's own module 5/6 recommendation)

- Program/Subject/Level as separate entities — `level`/`subject` stay free-text strings.
- Teacher contracts, payroll, HR workflows.
- Timetable / weekly schedule / room-conflict detection (module 7) — no `timeSlots` field in this
  slice at all, added later if a Timetable module gets built.
- Attendance (module 8) — depends on Timetable existing first per the architecture doc's own
  dependency note; out of scope here.

## Testing

Same as Phase 1: no test harness exists anywhere in this repo (`services/`, `apps/`) — verification
is `tsc --noEmit`, `nest build`, and manual `curl`/browser checks, consistent with
`docs/superpowers/plans/2026-08-11-education-service-foundation.md`'s own justification for that
choice.
