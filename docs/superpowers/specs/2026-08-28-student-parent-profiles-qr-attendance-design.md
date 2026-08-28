# Student & Parent Profiles with QR-Based Attendance (ArwaEduc)

## Context

ArwaEduc (`apps/education-apps`) currently has no student/parent profile pages — only list and register views for students. Parent information is stored as free-text fields directly on `Student` (`parentName`, `parentPhone`, `fatherName`, `motherName`, `parentRelation`), with no dedicated `Parent` entity. There is no way to view all children belonging to one parent, and no attendance check-in mechanism beyond manual entry.

This spec introduces:
1. A `Parent` entity, linked to one or more `Student` records.
2. QR/E-card-based passwordless access for parents to a read-only profile of their children.
3. QR-card-based classroom attendance scanning for students, restricted to authenticated staff sessions.
4. Automatic attendance status derivation (present/late/absent) and parent notifications.

## Goals

- Every student has a profile page (personal info, groups/inscriptions, attendance history, financial status).
- Every parent has a profile page listing all their children (siblings), each with today's status and financial summary at a glance.
- Staff can scan a student's QR/E-card in class to mark attendance instantly, with automatic late/absent detection.
- Parents receive real-time notifications when their child checks in (and are flagged automatically if the child does not).
- The design differentiates ArwaEduc as a market-competitive SaaS feature.

## Non-Goals

- No parent self-service actions (editing data, making payments) through the token-based portal — read-only only.
- No support for multiple parents per student in this iteration (one `Parent` per `Student`, matching the single guardian recorded at inscription time).
- No mobile native app — the QR link opens a responsive web page.
- No migration/backfill of historical free-text parent fields into the new `Parent` model (existing fields stay as deprecated, read-only history; only new students get linked to a `Parent`).

## Data Model Changes

### New model: `Parent`

```prisma
model Parent {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  name            String
  phone           String
  whatsapp        String?
  email           String?
  cin             String?
  address         String?
  accessTokenHash String   @unique   // sha256 of the raw token; raw token is only ever in the QR/URL
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  students        Student[]

  @@map("parents")
}
```

### `Student` changes

- Add `parentId String? @db.ObjectId` + relation to `Parent` (nullable, for gradual adoption — new registrations set it; existing records stay null and keep using the legacy free-text fields).
- Add `accessTokenHash String @unique` — backing the classroom attendance QR/E-card.
- Existing `parentName`, `parentPhone`, `fatherName`, `motherName`, `parentRelation` fields are kept as-is (deprecated for new records, still readable for historical data). No code path writes to both the legacy fields and `parentId` at once for a given record.

### `Attendance` changes

- `status` values become a proper enum: `PRESENT | LATE | ABSENT` (was free-form string).
- Add `scannedAt DateTime?` — actual scan timestamp (distinct from `date`, which is the class session's calendar date).
- Add `groupId String? @db.ObjectId` + relation to `Group` — which session this record belongs to, needed to compare `scannedAt` against the group's `timeSlots`.
- Uniqueness constraint on `(studentId, groupId, date)` to prevent duplicate scans for the same session.

### New model: `AttendanceNotification`

```prisma
model AttendanceNotification {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  attendanceId  String   @db.ObjectId
  attendance    Attendance @relation(fields: [attendanceId], references: [id], onDelete: Cascade)
  parentId      String   @db.ObjectId
  channel       String   // WHATSAPP | SMS | PUSH
  message       String
  status        String   // SENT | FAILED
  sentAt        DateTime @default(now())

  @@map("attendance_notifications")
}
```

### New model: `AccessLog` (audit trail)

```prisma
model AccessLog {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  parentId   String?  @db.ObjectId
  studentId  String?  @db.ObjectId
  ip         String?
  accessedAt DateTime @default(now())

  @@map("access_logs")
}
```

## Access & Security Model

### Parent access (passwordless magic link)

- QR/E-card encodes: `https://app.smartcity.ma/p/{rawToken}`.
- `rawToken` is a cryptographically random value (≥32 bytes, base64url). Only its SHA-256 hash (`accessTokenHash`) is stored server-side — the same pattern as password storage. A DB leak does not expose usable tokens.
- On request, the server hashes the incoming token and looks up `Parent.accessTokenHash`. On success, it returns the parent's profile (self + linked students) as read-only data. No session/cookie is created — every request re-validates the token in the URL.
- Rate limiting on the token-lookup endpoint (e.g., 10 attempts/minute/IP) to prevent brute-force guessing.
- Invalid tokens return a generic 404 (no distinction between "not found," "revoked," or "malformed") to avoid information leakage.
- Every successful (and optionally failed) lookup writes an `AccessLog` row (IP + timestamp) for audit purposes.
- Admin/secretary UI exposes a "Regenerate Token" action per parent: generates a new raw token, stores its hash (overwriting the old one), and shows the new raw token/QR once for reissuing the physical card. The old token stops working immediately.

### Student access (staff-only, in-app)

- The student's QR/E-card encodes only an opaque `studentAccessToken`, resolved the same hashed way, but the corresponding endpoint is only reachable from an authenticated staff session (ADMIN/SECRETARY role) — it is not a public passwordless entry point.
- Losing a physical student card carries no meaningful security exposure on its own, since it cannot be used without an active staff login.
- Same "Regenerate Token" capability exists for students (lost-card case).

## Attendance Scan Flow

1. Staff (already logged in) scans a student's QR in the classroom. The scan carries `studentAccessToken` + the currently selected `Group` (staff picks or the app infers it from the teacher's active session).
2. Server resolves the token to a `Student`, verifies the student belongs to the given `Group`, and finds today's matching `timeSlot`.
3. Status derivation: if `scannedAt <= timeSlot.startTime + 5min` grace period → `PRESENT`; otherwise → `LATE`.
4. An `Attendance` row is created (unique per `studentId + groupId + date` — a second scan for the same session is rejected with a clear "already marked" response, not a duplicate record).
5. On success, an `AttendanceNotification` is queued and sent (WhatsApp/push) to the linked `Parent`: e.g. "Your child [name] checked into [subject] at [time]" (message explicitly states late status when applicable).

## Automatic Absence Detection

- A scheduled job runs periodically (e.g. every 10 minutes) and, for each `Group` timeSlot that has ended (`now > endTime + grace period`) with no matching `Attendance` row for an enrolled student, creates an `Attendance` row with `status: ABSENT` and triggers an `AttendanceNotification` to the parent.

## Profile Pages

### Student profile (staff-facing)

- Header: photo, name, school level, current groups.
- Tabs: **Attendance** (monthly calendar view of present/late/absent), **Finance** (balance due + payment history), **Inscriptions** (SOUTIEN/FORMATION history), **Info** (personal details + link to linked parent's profile, when set).

### Parent profile (parent-facing, via magic link)

- Header: parent name, child count.
- One card per child: photo, name, today's status badge (✅ present / ⏰ late / ❌ absent), balance due. Tapping opens that child's read-only detail view (attendance history + payment history — no edit actions).
- Top summary: combined balance due across all children.

## Error Handling

- Invalid/revoked token → generic 404, logged.
- Scan for a student not enrolled in the selected group → rejected with a clear staff-facing error (not silently recorded).
- Duplicate scan for the same session → rejected with "already marked," original record untouched.
- Notification send failure (WhatsApp/SMS provider error) → `AttendanceNotification.status = FAILED`, attendance record itself is unaffected (attendance is source of truth; notification is best-effort).

## Testing

- Unit: token hashing/verification, late/absent status derivation given timeSlot boundaries, duplicate-scan rejection.
- Integration: full scan → attendance record → notification queued flow; parent magic-link returns only that parent's own children; rate limiting triggers after threshold.
- Scheduled job: absence detection correctly skips groups with no session today and correctly flags unmarked enrolled students after grace period.

## Open Items for Implementation Planning

- Notification provider choice (WhatsApp Business API vs SMS gateway) — not decided here, to be resolved during implementation planning based on cost/availability in Morocco.
- Physical QR/E-card generation/printing workflow (client-side vs a print-service) — out of scope for this spec, to be scoped separately if needed.
