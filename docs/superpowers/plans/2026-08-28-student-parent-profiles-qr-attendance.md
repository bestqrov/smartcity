# Student & Parent Profiles with QR-Based Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every ArwaEduc student and parent a profile, let parents access their children's profile via a passwordless QR/link, and let staff scan a student's QR in class to record attendance automatically (with late/absent detection and parent notifications).

**Architecture:** Add a `Parent` Prisma model linked to `Student`, plus hashed opaque access tokens on both `Parent` and `Student`. A new `parents` Express module exposes admin CRUD + a public, rate-limited magic-link endpoint. The existing `attendance` module gains a staff-only scan endpoint that derives PRESENT/LATE from the student's `Group.timeSlots`, a `node-cron` job that auto-flags ABSENT after each session ends, and a notification service (console-logging stub behind an interface, since the WhatsApp/SMS provider is an explicit open item) that fires on both. Two new Next.js pages render the student profile (staff-facing, inside the existing admin layout) and the parent profile (public, standalone, driven by the raw token in the URL).

**Tech Stack:** Express + Prisma (MongoDB) + TypeScript backend, Next.js 14 App Router frontend, Jest + ts-jest + supertest (newly added, backend only — no test framework exists in this repo today), `qrcode` (QR image generation), `html5-qrcode` (browser camera scanning), `express-rate-limit`, `node-cron`.

**Spec:** `docs/superpowers/specs/2026-08-28-student-parent-profiles-qr-attendance-design.md`

---

## Notes on scope decisions carried from the spec

- Only new students get `parentId` set going forward. No backfill of the legacy free-text parent fields — this plan does not touch existing student rows.
- Notification sending is implemented behind a `NotificationProvider` interface with a `ConsoleNotificationProvider` (logs + writes the `AttendanceNotification` row with `status: SENT`). Swapping in a real WhatsApp/SMS provider is out of scope (spec's "Open Items").
- This repo has no test framework at all (backend or frontend) prior to this plan. Task 1 adds a minimal Jest setup for the **backend only**, since the new logic that most needs unit coverage (token hashing, late/absent derivation, duplicate-scan prevention) lives there. Frontend tasks are verified manually in the browser per this repo's existing convention (no frontend test infra is introduced, to avoid an unrelated yak-shave) — each frontend task ends with a manual verification step instead of an automated test.
- QR **images** are generated client-side from the raw token URL at display time (using the `qrcode` package) — the raw token is only ever returned once, right after creation/regeneration, and is never re-derivable from the stored hash. The admin UI must show/print it at that moment.

---

## File Structure

**Backend (`apps/education-apps/`)**
- `prisma/schema.prisma` — modify: add `Parent`, `AttendanceNotification`, `AccessLog` models; modify `Student`, `Attendance`, `Group`.
- `src/utils/accessToken.ts` — new: raw token generation + SHA-256 hashing/verification helpers.
- `src/utils/attendanceStatus.ts` — new: pure function deriving PRESENT/LATE from scan time vs. timeSlot.
- `src/modules/parents/parents.service.ts` — new: CRUD + token issuance/regeneration + magic-link lookup.
- `src/modules/parents/parents.controller.ts` — new.
- `src/modules/parents/parents.routes.ts` — new: admin CRUD routes + public rate-limited `/profile/:token` route.
- `src/modules/notifications/notification.provider.ts` — new: `NotificationProvider` interface + `ConsoleNotificationProvider`.
- `src/modules/notifications/notification.service.ts` — new: builds messages, calls provider, writes `AttendanceNotification`.
- `src/modules/attendance/attendance.service.ts` — modify: add `scanAttendance`, keep existing manual `createAttendance`.
- `src/modules/attendance/attendance.controller.ts` — modify: add `scan` handler.
- `src/modules/attendance/attendance.routes.ts` — modify: add `POST /attendance/scan`.
- `src/modules/attendance/absence-job.ts` — new: `node-cron` scheduled absence sweep.
- `src/modules/students/students.service.ts` — modify: add `regenerateStudentToken`.
- `src/modules/students/students.controller.ts` / `students.routes.ts` — modify: add regenerate-token route.
- `src/app.ts` — modify: mount `parentsRoutes`, start the absence cron job.
- `src/server.ts` — check/modify: ensure cron job starts once on boot (not per-request).
- `package.json` — modify: add `jest`, `ts-jest`, `@types/jest`, `supertest`, `@types/supertest`, `express-rate-limit`, `node-cron`, `@types/node-cron`, `qrcode` (backend needs `qrcode` too, for any server-generated fallback — see Task 12) as devDependencies/dependencies; add `test` script.
- `jest.config.js` — new.
- `src/utils/accessToken.test.ts`, `src/utils/attendanceStatus.test.ts`, `src/modules/parents/parents.service.test.ts`, `src/modules/attendance/attendance.service.test.ts` — new test files (co-located, matching how the rest of this plan references them).

**Frontend (`apps/education-apps/frontend/`)**
- `lib/services/parents.ts` — new: API calls for parent CRUD + token regeneration.
- `lib/services/students.ts` — modify: add `regenerateStudentToken`.
- `lib/services/attendance.ts` — modify: add `scanAttendance`.
- `types/index.ts` — modify: add `Parent`, extend `Student`/`Attendance` types.
- `app/admin/parents/page.tsx` — new: parents list.
- `app/admin/parents/[id]/page.tsx` — new: parent detail (admin view) with regenerate-token + QR display.
- `app/admin/students/[id]/page.tsx` — new: student profile page (tabs: Attendance, Finance, Inscriptions, Info).
- `app/admin/attendance/scan/page.tsx` — new: camera-based scan screen for staff.
- `app/p/[token]/page.tsx` — new: public parent profile page (no admin layout/auth).
- `components/QrCodeCard.tsx` — new: renders a QR image + raw token/link for print/display.

---

## Task 1: Backend test infrastructure

**Files:**
- Modify: `apps/education-apps/package.json`
- Create: `apps/education-apps/jest.config.js`
- Create: `apps/education-apps/src/utils/sanity.test.ts`

- [ ] **Step 1: Install test dependencies**

Run: `cd apps/education-apps && npm install --save-dev jest ts-jest @types/jest supertest @types/supertest`

- [ ] **Step 2: Add Jest config**

Create `apps/education-apps/jest.config.js`:

```js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  setupFiles: ['dotenv/config'],
};
```

- [ ] **Step 3: Add the `test` script**

In `apps/education-apps/package.json`, inside `"scripts"`, add:

```json
"test": "jest"
```

- [ ] **Step 4: Write a sanity test**

Create `apps/education-apps/src/utils/sanity.test.ts`:

```ts
describe('jest setup', () => {
    it('runs', () => {
        expect(1 + 1).toBe(2);
    });
});
```

- [ ] **Step 5: Run it and confirm it passes**

Run: `cd apps/education-apps && npm test`
Expected: `1 passed`, exit code 0.

- [ ] **Step 6: Delete the sanity test and commit the infra**

Run: `rm apps/education-apps/src/utils/sanity.test.ts`

```bash
git add apps/education-apps/package.json apps/education-apps/package-lock.json apps/education-apps/jest.config.js
git commit -m "test: add Jest test infrastructure for backend"
```

---

## Task 2: Prisma schema changes

**Files:**
- Modify: `apps/education-apps/prisma/schema.prisma`

- [ ] **Step 1: Add the `Parent` model, `AttendanceNotification`, `AccessLog`, and modify `Student`/`Attendance`/`Group`**

In `apps/education-apps/prisma/schema.prisma`, change the `AttendanceStatus`-related section and the `Student`, `Attendance`, `Group` models as follows.

Add this enum near the other enums (after `enum InscriptionType { ... }`):

```prisma
enum AttendanceStatus {
  PRESENT
  LATE
  ABSENT
}

enum NotificationChannel {
  WHATSAPP
  SMS
  PUSH
}

enum NotificationStatus {
  SENT
  FAILED
}
```

Add the `Parent` model (after the `User` model):

```prisma
model Parent {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  name            String
  phone           String
  whatsapp        String?
  email           String?
  cin             String?
  address         String?
  accessTokenHash String   @unique
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  students        Student[]

  @@map("parents")
}
```

Modify the `Student` model — add these fields inside it (near the other parent-related fields, keep the existing `parentName`, `parentPhone`, `parentRelation`, `fatherName`, `motherName` untouched):

```prisma
  parentId        String?   @db.ObjectId
  parent          Parent?   @relation(fields: [parentId], references: [id])
  accessTokenHash String    @unique
```

Modify the `Attendance` model to replace `status String` with the enum and add the new fields and relations:

```prisma
model Attendance {
  id         String           @id @default(auto()) @map("_id") @db.ObjectId
  studentId  String           @db.ObjectId
  student    Student          @relation(fields: [studentId], references: [id], onDelete: Cascade)
  groupId    String?          @db.ObjectId
  group      Group?           @relation(fields: [groupId], references: [id])
  date       DateTime
  scannedAt  DateTime?
  status     AttendanceStatus
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  notifications AttendanceNotification[]

  @@unique([studentId, groupId, date])
  @@map("attendances")
}
```

Modify the `Group` model — add this line inside it (near `students Student[] ...`):

```prisma
  attendances   Attendance[]
```

Add the `AttendanceNotification` model (after `Attendance`):

```prisma
model AttendanceNotification {
  id           String              @id @default(auto()) @map("_id") @db.ObjectId
  attendanceId String              @db.ObjectId
  attendance   Attendance          @relation(fields: [attendanceId], references: [id], onDelete: Cascade)
  parentId     String              @db.ObjectId
  channel      NotificationChannel
  message      String
  status       NotificationStatus
  sentAt       DateTime            @default(now())

  @@map("attendance_notifications")
}
```

Add the `AccessLog` model (after `AttendanceNotification`):

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

> Note: `@@unique([studentId, groupId, date])` allows multiple `null` `groupId` rows (Mongo unique index treats each `null` as distinct), which is fine — it only enforces no-duplicate-scan for real group sessions, matching the spec's "duplicate scan for the same session" requirement.

- [ ] **Step 2: Generate the Prisma client and push the schema**

Run: `cd apps/education-apps && npx prisma generate`
Expected: `Generated Prisma Client` with no errors.

Run: `cd apps/education-apps && npx prisma db push`
Expected: schema applied to the MongoDB database with no errors. (If this fails because `DATABASE_URL` isn't set in your shell, source the project's `.env` first — check `apps/education-apps/DATABASE_SETUP.md` for the expected variable.)

- [ ] **Step 3: Commit**

```bash
git add apps/education-apps/prisma/schema.prisma
git commit -m "feat(schema): add Parent, AttendanceNotification, AccessLog models and attendance status enum"
```

---

## Task 3: Access token utility (generate + hash + verify)

**Files:**
- Create: `apps/education-apps/src/utils/accessToken.ts`
- Test: `apps/education-apps/src/utils/accessToken.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/education-apps/src/utils/accessToken.test.ts`:

```ts
import { generateRawToken, hashToken, verifyToken } from './accessToken';

describe('accessToken', () => {
    it('generates a url-safe token of sufficient length', () => {
        const token = generateRawToken();
        expect(token.length).toBeGreaterThanOrEqual(32);
        expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('generates different tokens each call', () => {
        expect(generateRawToken()).not.toBe(generateRawToken());
    });

    it('hashes deterministically', () => {
        const token = generateRawToken();
        expect(hashToken(token)).toBe(hashToken(token));
    });

    it('verifyToken returns true for a matching raw token + hash', () => {
        const token = generateRawToken();
        const hash = hashToken(token);
        expect(verifyToken(token, hash)).toBe(true);
    });

    it('verifyToken returns false for a non-matching raw token', () => {
        const hash = hashToken(generateRawToken());
        expect(verifyToken('not-the-right-token', hash)).toBe(false);
    });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd apps/education-apps && npm test -- accessToken`
Expected: FAIL — `Cannot find module './accessToken'`.

- [ ] **Step 3: Implement**

Create `apps/education-apps/src/utils/accessToken.ts`:

```ts
import crypto from 'crypto';

export const generateRawToken = (): string => {
    return crypto.randomBytes(32).toString('base64url');
};

export const hashToken = (rawToken: string): string => {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
};

export const verifyToken = (rawToken: string, storedHash: string): boolean => {
    const candidateHash = hashToken(rawToken);
    const candidateBuffer = Buffer.from(candidateHash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (candidateBuffer.length !== storedBuffer.length) return false;
    return crypto.timingSafeEqual(candidateBuffer, storedBuffer);
};
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- accessToken`
Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add apps/education-apps/src/utils/accessToken.ts apps/education-apps/src/utils/accessToken.test.ts
git commit -m "feat: add hashed access token generation/verification utility"
```

---

## Task 4: Attendance status derivation (present/late)

**Files:**
- Create: `apps/education-apps/src/utils/attendanceStatus.ts`
- Test: `apps/education-apps/src/utils/attendanceStatus.test.ts`

`Group.timeSlots` is stored as loosely-typed JSON: `[{ day: string, startTime: string, endTime: string }]`, where `day` is an English weekday name (e.g. `"Monday"`) and `startTime`/`endTime` are `"HH:MM"` 24h strings. This task adds a pure function that, given the scan time and the group's time slots, finds today's slot and decides `PRESENT` vs `LATE`, with a 5-minute grace period.

- [ ] **Step 1: Write the failing tests**

Create `apps/education-apps/src/utils/attendanceStatus.test.ts`:

```ts
import { deriveAttendanceStatus, TimeSlot } from './attendanceStatus';

const mondaySlot: TimeSlot = { day: 'Monday', startTime: '09:00', endTime: '10:00' };

// 2026-08-31 is a Monday
const mondayAt = (hh: number, mm: number) => new Date(2026, 7, 31, hh, mm, 0);

describe('deriveAttendanceStatus', () => {
    it('returns PRESENT when scanned before the slot start', () => {
        expect(deriveAttendanceStatus([mondaySlot], mondayAt(8, 55))).toBe('PRESENT');
    });

    it('returns PRESENT when scanned within the grace period', () => {
        expect(deriveAttendanceStatus([mondaySlot], mondayAt(9, 4))).toBe('PRESENT');
    });

    it('returns LATE when scanned after the grace period', () => {
        expect(deriveAttendanceStatus([mondaySlot], mondayAt(9, 6))).toBe('LATE');
    });

    it('throws when there is no slot for the scan day', () => {
        const tuesdaySlot: TimeSlot = { day: 'Tuesday', startTime: '09:00', endTime: '10:00' };
        expect(() => deriveAttendanceStatus([tuesdaySlot], mondayAt(9, 0))).toThrow(
            'No scheduled session for this group today'
        );
    });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd apps/education-apps && npm test -- attendanceStatus`
Expected: FAIL — `Cannot find module './attendanceStatus'`.

- [ ] **Step 3: Implement**

Create `apps/education-apps/src/utils/attendanceStatus.ts`:

```ts
export interface TimeSlot {
    day: string;
    startTime: string;
    endTime: string;
}

const GRACE_PERIOD_MINUTES = 5;
const WEEKDAY_NAMES = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

const parseTimeOnDate = (date: Date, hhmm: string): Date => {
    const [hours, minutes] = hhmm.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
};

export const deriveAttendanceStatus = (
    timeSlots: TimeSlot[],
    scannedAt: Date
): 'PRESENT' | 'LATE' => {
    const dayName = WEEKDAY_NAMES[scannedAt.getDay()];
    const todaySlot = timeSlots.find((slot) => slot.day === dayName);

    if (!todaySlot) {
        throw new Error('No scheduled session for this group today');
    }

    const slotStart = parseTimeOnDate(scannedAt, todaySlot.startTime);
    const graceDeadline = new Date(slotStart.getTime() + GRACE_PERIOD_MINUTES * 60_000);

    return scannedAt.getTime() <= graceDeadline.getTime() ? 'PRESENT' : 'LATE';
};
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- attendanceStatus`
Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add apps/education-apps/src/utils/attendanceStatus.ts apps/education-apps/src/utils/attendanceStatus.test.ts
git commit -m "feat: add present/late derivation from group time slots"
```

---

## Task 5: Notification provider + service

**Files:**
- Create: `apps/education-apps/src/modules/notifications/notification.provider.ts`
- Create: `apps/education-apps/src/modules/notifications/notification.service.ts`
- Test: `apps/education-apps/src/modules/notifications/notification.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/education-apps/src/modules/notifications/notification.service.test.ts`:

```ts
import { sendAttendanceNotification } from './notification.service';
import { NotificationProvider } from './notification.provider';
import prisma from '../../config/database';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        attendanceNotification: { create: jest.fn() },
    },
}));

describe('sendAttendanceNotification', () => {
    it('sends via the provider and records a SENT AttendanceNotification', async () => {
        const fakeProvider: NotificationProvider = {
            send: jest.fn().mockResolvedValue(undefined),
        };
        (prisma.attendanceNotification.create as jest.Mock).mockResolvedValue({});

        await sendAttendanceNotification(fakeProvider, {
            attendanceId: 'att1',
            parentId: 'parent1',
            channel: 'WHATSAPP',
            message: 'Your child checked in',
        });

        expect(fakeProvider.send).toHaveBeenCalledWith('parent1', 'Your child checked in');
        expect(prisma.attendanceNotification.create).toHaveBeenCalledWith({
            data: {
                attendanceId: 'att1',
                parentId: 'parent1',
                channel: 'WHATSAPP',
                message: 'Your child checked in',
                status: 'SENT',
            },
        });
    });

    it('records FAILED when the provider throws', async () => {
        const fakeProvider: NotificationProvider = {
            send: jest.fn().mockRejectedValue(new Error('provider down')),
        };
        (prisma.attendanceNotification.create as jest.Mock).mockResolvedValue({});

        await sendAttendanceNotification(fakeProvider, {
            attendanceId: 'att1',
            parentId: 'parent1',
            channel: 'WHATSAPP',
            message: 'Your child checked in',
        });

        expect(prisma.attendanceNotification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ status: 'FAILED' }),
        });
    });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd apps/education-apps && npm test -- notification.service`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the provider interface**

Create `apps/education-apps/src/modules/notifications/notification.provider.ts`:

```ts
export interface NotificationProvider {
    send(parentId: string, message: string): Promise<void>;
}

export class ConsoleNotificationProvider implements NotificationProvider {
    async send(parentId: string, message: string): Promise<void> {
        console.log(`[notification] to parent ${parentId}: ${message}`);
    }
}
```

- [ ] **Step 4: Implement the service**

Create `apps/education-apps/src/modules/notifications/notification.service.ts`:

```ts
import prisma from '../../config/database';
import { NotificationProvider } from './notification.provider';

interface SendAttendanceNotificationInput {
    attendanceId: string;
    parentId: string;
    channel: 'WHATSAPP' | 'SMS' | 'PUSH';
    message: string;
}

export const sendAttendanceNotification = async (
    provider: NotificationProvider,
    input: SendAttendanceNotificationInput
): Promise<void> => {
    let status: 'SENT' | 'FAILED' = 'SENT';

    try {
        await provider.send(input.parentId, input.message);
    } catch (error) {
        status = 'FAILED';
    }

    await prisma.attendanceNotification.create({
        data: {
            attendanceId: input.attendanceId,
            parentId: input.parentId,
            channel: input.channel,
            message: input.message,
            status,
        },
    });
};
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- notification.service`
Expected: `2 passed`.

- [ ] **Step 6: Commit**

```bash
git add apps/education-apps/src/modules/notifications
git commit -m "feat: add notification provider interface and attendance notification service"
```

---

## Task 6: Parent module — service, controller, routes (admin CRUD)

**Files:**
- Create: `apps/education-apps/src/modules/parents/parents.service.ts`
- Create: `apps/education-apps/src/modules/parents/parents.controller.ts`
- Create: `apps/education-apps/src/modules/parents/parents.routes.ts`
- Test: `apps/education-apps/src/modules/parents/parents.service.test.ts`
- Modify: `apps/education-apps/src/app.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/education-apps/src/modules/parents/parents.service.test.ts`:

```ts
import prisma from '../../config/database';
import { createParent, regenerateParentToken, getParentByRawToken } from './parents.service';
import * as accessToken from '../../utils/accessToken';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        parent: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    },
}));

describe('parents.service', () => {
    afterEach(() => jest.clearAllMocks());

    it('createParent stores a hash, not the raw token, and returns the raw token once', async () => {
        (prisma.parent.create as jest.Mock).mockResolvedValue({ id: 'p1', name: 'Fatima' });

        const result = await createParent({ name: 'Fatima', phone: '0600000000' });

        expect(prisma.parent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                name: 'Fatima',
                phone: '0600000000',
                accessTokenHash: expect.any(String),
            }),
        });
        expect(result.rawToken).toEqual(expect.any(String));
        expect(result.parent).toEqual({ id: 'p1', name: 'Fatima' });
    });

    it('regenerateParentToken overwrites the stored hash and returns a new raw token', async () => {
        (prisma.parent.update as jest.Mock).mockResolvedValue({ id: 'p1' });

        const result = await regenerateParentToken('p1');

        expect(prisma.parent.update).toHaveBeenCalledWith({
            where: { id: 'p1' },
            data: { accessTokenHash: expect.any(String) },
        });
        expect(result.rawToken).toEqual(expect.any(String));
    });

    it('getParentByRawToken returns null for a token that matches no stored hash', async () => {
        (prisma.parent.findUnique as jest.Mock).mockResolvedValue(null);
        jest.spyOn(accessToken, 'hashToken').mockReturnValue('some-hash');

        const result = await getParentByRawToken('bad-token');

        expect(prisma.parent.findUnique).toHaveBeenCalledWith({
            where: { accessTokenHash: 'some-hash' },
            include: { students: true },
        });
        expect(result).toBeNull();
    });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd apps/education-apps && npm test -- parents.service`
Expected: FAIL — `Cannot find module './parents.service'`.

- [ ] **Step 3: Implement the service**

Create `apps/education-apps/src/modules/parents/parents.service.ts`:

```ts
import prisma from '../../config/database';
import { generateRawToken, hashToken } from '../../utils/accessToken';

export interface CreateParentData {
    name: string;
    phone: string;
    whatsapp?: string;
    email?: string;
    cin?: string;
    address?: string;
}

export const createParent = async (data: CreateParentData) => {
    const rawToken = generateRawToken();

    const parent = await prisma.parent.create({
        data: {
            ...data,
            accessTokenHash: hashToken(rawToken),
        },
    });

    return { parent, rawToken };
};

export const getAllParents = async () => {
    return prisma.parent.findMany({
        include: { students: true },
        orderBy: { createdAt: 'desc' },
    });
};

export const getParentById = async (id: string) => {
    const parent = await prisma.parent.findUnique({
        where: { id },
        include: { students: true },
    });

    if (!parent) {
        throw new Error('Parent not found');
    }

    return parent;
};

export const updateParent = async (id: string, data: Partial<CreateParentData>) => {
    return prisma.parent.update({ where: { id }, data });
};

export const regenerateParentToken = async (id: string) => {
    const rawToken = generateRawToken();

    const parent = await prisma.parent.update({
        where: { id },
        data: { accessTokenHash: hashToken(rawToken) },
    });

    return { parent, rawToken };
};

export const getParentByRawToken = async (rawToken: string) => {
    const accessTokenHash = hashToken(rawToken);

    return prisma.parent.findUnique({
        where: { accessTokenHash },
        include: { students: true },
    });
};
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- parents.service`
Expected: `3 passed`.

- [ ] **Step 5: Implement the controller**

Create `apps/education-apps/src/modules/parents/parents.controller.ts`:

```ts
import { Request, Response } from 'express';
import {
    createParent,
    getAllParents,
    getParentById,
    updateParent,
    regenerateParentToken,
    getParentByRawToken,
} from './parents.service';
import { sendSuccess, sendError } from '../../utils/response';

export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, phone, whatsapp, email, cin, address } = req.body;

        if (!name || !phone) {
            sendError(res, 'name and phone are required', 'Validation error', 400);
            return;
        }

        const { parent, rawToken } = await createParent({ name, phone, whatsapp, email, cin, address });
        sendSuccess(res, { parent, rawToken }, 'Parent created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create parent', 400);
    }
};

export const getAll = async (_req: Request, res: Response): Promise<void> => {
    try {
        const parents = await getAllParents();
        sendSuccess(res, parents, 'Parents retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve parents', 400);
    }
};

export const getById = async (req: Request, res: Response): Promise<void> => {
    try {
        const parent = await getParentById(req.params.id);
        sendSuccess(res, parent, 'Parent retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve parent', 404);
    }
};

export const update = async (req: Request, res: Response): Promise<void> => {
    try {
        const parent = await updateParent(req.params.id, req.body);
        sendSuccess(res, parent, 'Parent updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update parent', 400);
    }
};

export const regenerateToken = async (req: Request, res: Response): Promise<void> => {
    try {
        const { parent, rawToken } = await regenerateParentToken(req.params.id);
        sendSuccess(res, { parent, rawToken }, 'Token regenerated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to regenerate token', 400);
    }
};

export const getPublicProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const parent = await getParentByRawToken(req.params.token);

        if (!parent) {
            sendError(res, 'Not found', 'Not found', 404);
            return;
        }

        const { accessTokenHash, ...safeParent } = parent;
        sendSuccess(res, safeParent, 'Profile retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, 'Not found', 'Not found', 404);
    }
};
```

- [ ] **Step 6: Implement the routes**

Create `apps/education-apps/src/modules/parents/parents.routes.ts`:

```ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
    create,
    getAll,
    getById,
    update,
    regenerateToken,
    getPublicProfile,
} from './parents.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

const router = Router();

const publicProfileLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
});

// Public, passwordless — must come before the authMiddleware below
router.get('/profile/:token', publicProfileLimiter, getPublicProfile);

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'SECRETARY', 'SUPER_ADMIN'));

router.post('/', create);
router.get('/', getAll);
router.get('/:id', getById);
router.put('/:id', update);
router.post('/:id/regenerate-token', regenerateToken);

export default router;
```

- [ ] **Step 7: Mount the routes**

In `apps/education-apps/src/app.ts`, add the import near the other module imports:

```ts
import parentsRoutes from './modules/parents/parents.routes';
```

And add the mount line next to `apiRouter.use('/students', studentsRoutes);`:

```ts
apiRouter.use('/parents', parentsRoutes);
```

- [ ] **Step 8: Install the rate limiter dependency**

Run: `cd apps/education-apps && npm install express-rate-limit`

- [ ] **Step 9: Run full backend test suite**

Run: `cd apps/education-apps && npm test`
Expected: all suites pass.

- [ ] **Step 10: Commit**

```bash
git add apps/education-apps/src/modules/parents apps/education-apps/src/app.ts apps/education-apps/package.json apps/education-apps/package-lock.json
git commit -m "feat: add Parent module with admin CRUD and rate-limited public magic-link profile"
```

---

## Task 7: Student token regeneration endpoint

**Files:**
- Modify: `apps/education-apps/src/modules/students/students.service.ts`
- Modify: `apps/education-apps/src/modules/students/students.controller.ts`
- Modify: `apps/education-apps/src/modules/students/students.routes.ts`
- Test: `apps/education-apps/src/modules/students/students.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/education-apps/src/modules/students/students.service.test.ts`:

```ts
import prisma from '../../config/database';
import { regenerateStudentToken } from './students.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        student: { update: jest.fn() },
    },
}));

describe('regenerateStudentToken', () => {
    it('overwrites the stored hash and returns a new raw token', async () => {
        (prisma.student.update as jest.Mock).mockResolvedValue({ id: 's1' });

        const result = await regenerateStudentToken('s1');

        expect(prisma.student.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { accessTokenHash: expect.any(String) },
        });
        expect(result.rawToken).toEqual(expect.any(String));
    });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd apps/education-apps && npm test -- students.service`
Expected: FAIL — `regenerateStudentToken is not a function`.

- [ ] **Step 3: Implement in the service**

In `apps/education-apps/src/modules/students/students.service.ts`, add the import at the top:

```ts
import { generateRawToken, hashToken } from '../../utils/accessToken';
```

And add this function (near `deleteStudent`):

```ts
export const regenerateStudentToken = async (id: string) => {
    const rawToken = generateRawToken();

    const student = await prisma.student.update({
        where: { id },
        data: { accessTokenHash: hashToken(rawToken) },
    });

    return { student, rawToken };
};
```

Also update `createStudent` to set an initial token — add `accessTokenHash: hashToken(generateRawToken())` to the `data` object inside the `tx.student.create` call (alongside the other fields).

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd apps/education-apps && npm test -- students.service`
Expected: `1 passed`.

- [ ] **Step 5: Add the controller handler**

In `apps/education-apps/src/modules/students/students.controller.ts`, add the import:

```ts
import { regenerateStudentToken } from './students.service';
```

(Merge with whatever existing import line pulls from `./students.service` if one exists — add `regenerateStudentToken` to that list instead of duplicating the import.)

Add the handler:

```ts
export const regenerateToken = async (req: Request, res: Response): Promise<void> => {
    try {
        const { student, rawToken } = await regenerateStudentToken(req.params.id);
        sendSuccess(res, { student, rawToken }, 'Token regenerated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to regenerate token', 400);
    }
};
```

- [ ] **Step 6: Add the route**

In `apps/education-apps/src/modules/students/students.routes.ts`, add:

```ts
router.post('/:id/regenerate-token', regenerateToken);
```

(Add `regenerateToken` to the existing import from `./students.controller`.)

- [ ] **Step 7: Commit**

```bash
git add apps/education-apps/src/modules/students
git commit -m "feat: add student access token regeneration endpoint"
```

---

## Task 8: Attendance scan endpoint

**Files:**
- Modify: `apps/education-apps/src/modules/attendance/attendance.service.ts`
- Modify: `apps/education-apps/src/modules/attendance/attendance.controller.ts`
- Modify: `apps/education-apps/src/modules/attendance/attendance.routes.ts`
- Test: `apps/education-apps/src/modules/attendance/attendance.service.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/education-apps/src/modules/attendance/attendance.service.test.ts`:

```ts
import prisma from '../../config/database';
import { scanAttendance } from './attendance.service';
import * as accessToken from '../../utils/accessToken';
import { ConsoleNotificationProvider } from '../notifications/notification.provider';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        student: { findUnique: jest.fn() },
        group: { findUnique: jest.fn() },
        attendance: { findUnique: jest.fn(), create: jest.fn() },
        attendanceNotification: { create: jest.fn() },
    },
}));

jest.mock('../notifications/notification.provider', () => ({
    ConsoleNotificationProvider: jest.fn().mockImplementation(() => ({
        send: jest.fn().mockResolvedValue(undefined),
    })),
}));

// 2026-08-31 is a Monday
const MONDAY_9AM = new Date(2026, 7, 31, 9, 0, 0);

describe('scanAttendance', () => {
    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(MONDAY_9AM);
        jest.clearAllMocks();
    });

    afterEach(() => jest.useRealTimers());

    it('throws when the token matches no student', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(scanAttendance('bad-token', 'group1')).rejects.toThrow('Student not found');
    });

    it('throws when the student is not enrolled in the given group', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({
            id: 's1',
            accessTokenHash: accessToken.hashToken('tok'),
            parentId: 'p1',
            groupIds: ['other-group'],
        });

        await expect(scanAttendance('tok', 'group1')).rejects.toThrow('Student is not enrolled in this group');
    });

    it('creates a PRESENT attendance and rejects a second scan for the same session', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({
            id: 's1',
            accessTokenHash: accessToken.hashToken('tok'),
            parentId: 'p1',
            groupIds: ['group1'],
        });
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({
            id: 'group1',
            timeSlots: [{ day: 'Monday', startTime: '09:00', endTime: '10:00' }],
        });
        (prisma.attendance.findUnique as jest.Mock).mockResolvedValueOnce(null);
        (prisma.attendance.create as jest.Mock).mockResolvedValue({ id: 'att1', status: 'PRESENT' });

        const result = await scanAttendance('tok', 'group1');
        expect(result.status).toBe('PRESENT');

        (prisma.attendance.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'att1' });
        await expect(scanAttendance('tok', 'group1')).rejects.toThrow('Attendance already marked for this session');
    });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd apps/education-apps && npm test -- attendance.service`
Expected: FAIL — `scanAttendance is not a function`.

- [ ] **Step 3: Implement**

In `apps/education-apps/src/modules/attendance/attendance.service.ts`, replace the file contents with:

```ts
import prisma from '../../config/database';
import { hashToken } from '../../utils/accessToken';
import { deriveAttendanceStatus, TimeSlot } from '../../utils/attendanceStatus';
import { ConsoleNotificationProvider } from '../notifications/notification.provider';
import { sendAttendanceNotification } from '../notifications/notification.service';

interface CreateAttendanceData {
    studentId: string;
    date: Date;
    status: string;
}

export const createAttendance = async (data: CreateAttendanceData) => {
    const { studentId, date, status } = data;

    if (!['PRESENT', 'LATE', 'ABSENT'].includes(status)) {
        throw new Error('Status must be one of PRESENT, LATE, ABSENT');
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
        throw new Error('Student not found');
    }

    const attendance = await prisma.attendance.create({
        data: { studentId, date, status: status as any },
        include: { student: true },
    });

    return attendance;
};

export const getAttendanceByStudent = async (studentId: string) => {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
        throw new Error('Student not found');
    }

    return prisma.attendance.findMany({
        where: { studentId },
        include: { student: true },
        orderBy: { date: 'desc' },
    });
};

export const scanAttendance = async (rawStudentToken: string, groupId: string) => {
    const accessTokenHash = hashToken(rawStudentToken);

    const student = await prisma.student.findUnique({
        where: { accessTokenHash },
    });

    if (!student) {
        throw new Error('Student not found');
    }

    if (!student.groupIds.includes(groupId)) {
        throw new Error('Student is not enrolled in this group');
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
        throw new Error('Group not found');
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const existing = await prisma.attendance.findUnique({
        where: {
            studentId_groupId_date: {
                studentId: student.id,
                groupId,
                date: today,
            },
        },
    });

    if (existing) {
        throw new Error('Attendance already marked for this session');
    }

    const status = deriveAttendanceStatus((group.timeSlots as unknown as TimeSlot[]) || [], now);

    const attendance = await prisma.attendance.create({
        data: {
            studentId: student.id,
            groupId,
            date: today,
            scannedAt: now,
            status: status as any,
        },
    });

    if (student.parentId) {
        const message = status === 'LATE'
            ? `Your child ${student.name} arrived late to class at ${now.toLocaleTimeString()}`
            : `Your child ${student.name} checked into class at ${now.toLocaleTimeString()}`;

        await sendAttendanceNotification(new ConsoleNotificationProvider(), {
            attendanceId: attendance.id,
            parentId: student.parentId,
            channel: 'WHATSAPP',
            message,
        });
    }

    return attendance;
};
```

> Note: the `studentId_groupId_date` compound-unique lookup name is Prisma's default generated name for `@@unique([studentId, groupId, date])` from Task 2 — matches automatically, no extra config needed.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd apps/education-apps && npm test -- attendance.service`
Expected: `4 passed`.

- [ ] **Step 5: Add the controller handler**

In `apps/education-apps/src/modules/attendance/attendance.controller.ts`, add the import:

```ts
import { scanAttendance } from './attendance.service';
```

(Merge into the existing import from `./attendance.service`.)

Add the handler:

```ts
export const scan = async (req: Request, res: Response): Promise<void> => {
    try {
        const { studentToken, groupId } = req.body;

        if (!studentToken || !groupId) {
            sendError(res, 'studentToken and groupId are required', 'Validation error', 400);
            return;
        }

        const attendance = await scanAttendance(studentToken, groupId);
        sendSuccess(res, attendance, 'Attendance recorded', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to record attendance', 400);
    }
};
```

- [ ] **Step 6: Add the route**

In `apps/education-apps/src/modules/attendance/attendance.routes.ts`, add `scan` to the import from `./attendance.controller` and add:

```ts
router.post('/scan', scan);
```

(This lands under the existing `router.use(authMiddleware); router.use(roleMiddleware('ADMIN'));` — matches the spec's "staff-only" requirement. If secretaries also run classroom scanning in practice, broaden to `roleMiddleware('ADMIN', 'SECRETARY')` — confirm with the user before broadening, since the existing file scopes attendance to ADMIN only today.)

- [ ] **Step 7: Commit**

```bash
git add apps/education-apps/src/modules/attendance
git commit -m "feat: add staff-only attendance scan endpoint with present/late derivation and parent notification"
```

---

## Task 9: Automatic absence sweep (cron job)

**Files:**
- Create: `apps/education-apps/src/modules/attendance/absence-job.ts`
- Modify: `apps/education-apps/src/server.ts`
- Test: (covered by Task 4's pure-function tests; the cron wiring itself is verified manually per Step 4 below, since it depends on wall-clock/db timing not worth mocking here)

- [ ] **Step 1: Install `node-cron`**

Run: `cd apps/education-apps && npm install node-cron && npm install --save-dev @types/node-cron`

- [ ] **Step 2: Implement the sweep**

Create `apps/education-apps/src/modules/attendance/absence-job.ts`:

```ts
import cron from 'node-cron';
import prisma from '../../config/database';
import { TimeSlot } from '../../utils/attendanceStatus';
import { ConsoleNotificationProvider } from '../notifications/notification.provider';
import { sendAttendanceNotification } from '../notifications/notification.service';

const GRACE_PERIOD_MINUTES = 10;
const WEEKDAY_NAMES = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

const parseTimeOnDate = (date: Date, hhmm: string): Date => {
    const [hours, minutes] = hhmm.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
};

export const runAbsenceSweep = async (): Promise<void> => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayName = WEEKDAY_NAMES[now.getDay()];

    const groups = await prisma.group.findMany({ include: { students: true } });

    for (const group of groups) {
        const timeSlots = (group.timeSlots as unknown as TimeSlot[]) || [];
        const todaySlot = timeSlots.find((slot) => slot.day === dayName);
        if (!todaySlot) continue;

        const slotEnd = parseTimeOnDate(now, todaySlot.endTime);
        const sweepDeadline = new Date(slotEnd.getTime() + GRACE_PERIOD_MINUTES * 60_000);
        if (now.getTime() < sweepDeadline.getTime()) continue;

        for (const student of group.students) {
            const existing = await prisma.attendance.findUnique({
                where: {
                    studentId_groupId_date: {
                        studentId: student.id,
                        groupId: group.id,
                        date: today,
                    },
                },
            });
            if (existing) continue;

            const attendance = await prisma.attendance.create({
                data: {
                    studentId: student.id,
                    groupId: group.id,
                    date: today,
                    status: 'ABSENT',
                },
            });

            if (student.parentId) {
                await sendAttendanceNotification(new ConsoleNotificationProvider(), {
                    attendanceId: attendance.id,
                    parentId: student.parentId,
                    channel: 'WHATSAPP',
                    message: `Your child ${student.name} did not check in to class today.`,
                });
            }
        }
    }
};

export const startAbsenceCronJob = (): void => {
    cron.schedule('*/10 * * * *', () => {
        runAbsenceSweep().catch((error) => {
            console.error('[absence-job] sweep failed:', error);
        });
    });
};
```

- [ ] **Step 3: Start the job on boot**

Find `apps/education-apps/src/server.ts` and read it first to see the current boot sequence, then add near the top-level startup code (after the server starts listening):

```ts
import { startAbsenceCronJob } from './modules/attendance/absence-job';
```

```ts
startAbsenceCronJob();
```

- [ ] **Step 4: Manual verification**

Run: `cd apps/education-apps && npm run dev`
Expected: server boots with no errors and no cron-related exceptions in the log. (Full end-to-end verification — a real group session ending with an unmarked enrolled student — happens in Task 13's manual QA pass, once the frontend scan screen exists to create realistic data.)

- [ ] **Step 5: Commit**

```bash
git add apps/education-apps/src/modules/attendance/absence-job.ts apps/education-apps/src/server.ts apps/education-apps/package.json apps/education-apps/package-lock.json
git commit -m "feat: add scheduled auto-absence sweep with parent notification"
```

---

## Task 10: Access log on parent magic-link lookups

**Files:**
- Modify: `apps/education-apps/src/modules/parents/parents.controller.ts`

- [ ] **Step 1: Record an `AccessLog` row on every public profile lookup**

In `apps/education-apps/src/modules/parents/parents.controller.ts`, update `getPublicProfile`:

```ts
export const getPublicProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const parent = await getParentByRawToken(req.params.token);

        if (!parent) {
            sendError(res, 'Not found', 'Not found', 404);
            return;
        }

        await prisma.accessLog.create({
            data: { parentId: parent.id, ip: req.ip },
        });

        const { accessTokenHash, ...safeParent } = parent;
        sendSuccess(res, safeParent, 'Profile retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, 'Not found', 'Not found', 404);
    }
};
```

Add the import at the top of the file:

```ts
import prisma from '../../config/database';
```

- [ ] **Step 2: Manual verification**

Run: `cd apps/education-apps && npm run dev`, then in another terminal:
```bash
curl -i http://localhost:3000/api/parents/profile/nonexistent-token
```
Expected: `404` JSON response, no server crash.

- [ ] **Step 3: Commit**

```bash
git add apps/education-apps/src/modules/parents/parents.controller.ts
git commit -m "feat: log parent magic-link access attempts for audit"
```

---

## Task 11: Frontend types and API services

**Files:**
- Modify: `apps/education-apps/frontend/types/index.ts`
- Create: `apps/education-apps/frontend/lib/services/parents.ts`
- Modify: `apps/education-apps/frontend/lib/services/students.ts`
- Modify: `apps/education-apps/frontend/lib/services/attendance.ts`

- [ ] **Step 1: Extend types**

In `apps/education-apps/frontend/types/index.ts`, add near the `Student` interface:

```ts
export interface Parent {
    id: string;
    name: string;
    phone: string;
    whatsapp?: string;
    email?: string;
    cin?: string;
    address?: string;
    students: Student[];
    createdAt: string;
    updatedAt: string;
}
```

And add `parentId?: string;` and `parent?: Parent;` fields to the existing `Student` interface (do not remove any existing field).

Find the `Attendance` interface in the same file and change its `status` field type from `string` to `'PRESENT' | 'LATE' | 'ABSENT'`; add `scannedAt?: string;` and `groupId?: string;`.

- [ ] **Step 2: Add the parents API service**

Create `apps/education-apps/frontend/lib/services/parents.ts`:

```ts
import api from '../api';
import type { Parent, ApiResponse } from '@/types';

export async function getParents(): Promise<Parent[]> {
    const response = await api.get<ApiResponse<Parent[]>>('/parents');
    return response.data.data;
}

export async function getParentById(id: string): Promise<Parent> {
    const response = await api.get<ApiResponse<Parent>>(`/parents/${id}`);
    return response.data.data;
}

export async function createParent(data: {
    name: string;
    phone: string;
    whatsapp?: string;
    email?: string;
    cin?: string;
    address?: string;
}): Promise<{ parent: Parent; rawToken: string }> {
    const response = await api.post<ApiResponse<{ parent: Parent; rawToken: string }>>('/parents', data);
    return response.data.data;
}

export async function regenerateParentToken(id: string): Promise<{ parent: Parent; rawToken: string }> {
    const response = await api.post<ApiResponse<{ parent: Parent; rawToken: string }>>(`/parents/${id}/regenerate-token`);
    return response.data.data;
}

export async function getPublicParentProfile(token: string): Promise<Parent> {
    const response = await api.get<ApiResponse<Parent>>(`/parents/profile/${token}`);
    return response.data.data;
}
```

- [ ] **Step 3: Add `regenerateStudentToken` to the students service**

In `apps/education-apps/frontend/lib/services/students.ts`, add:

```ts
export async function regenerateStudentToken(id: string): Promise<{ student: Student; rawToken: string }> {
    const response = await api.post<ApiResponse<{ student: Student; rawToken: string }>>(`/students/${id}/regenerate-token`);
    return response.data.data;
}
```

- [ ] **Step 4: Add `scanAttendance` to the attendance service**

In `apps/education-apps/frontend/lib/services/attendance.ts`, add:

```ts
export async function scanAttendance(studentToken: string, groupId: string): Promise<Attendance> {
    const response = await api.post<ApiResponse<Attendance>>('/attendance/scan', { studentToken, groupId });
    return response.data.data;
}
```

- [ ] **Step 5: Type-check**

Run: `cd apps/education-apps/frontend && npx tsc --noEmit`
Expected: no new type errors introduced by these files (pre-existing unrelated errors, if any, are out of scope).

- [ ] **Step 6: Commit**

```bash
git add apps/education-apps/frontend/types/index.ts apps/education-apps/frontend/lib/services/parents.ts apps/education-apps/frontend/lib/services/students.ts apps/education-apps/frontend/lib/services/attendance.ts
git commit -m "feat(frontend): add parent types and API services, extend student/attendance types"
```

---

## Task 12: QR code display component

**Files:**
- Create: `apps/education-apps/frontend/components/QrCodeCard.tsx`

- [ ] **Step 1: Install the QR library**

Run: `cd apps/education-apps/frontend && npm install qrcode && npm install --save-dev @types/qrcode`

- [ ] **Step 2: Implement the component**

Create `apps/education-apps/frontend/components/QrCodeCard.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeCardProps {
    title: string;
    url: string;
}

export default function QrCodeCard({ title, url }: QrCodeCardProps) {
    const [dataUrl, setDataUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        QRCode.toDataURL(url, { width: 240 }).then((generated) => {
            if (!cancelled) setDataUrl(generated);
        });
        return () => {
            cancelled = true;
        };
    }, [url]);

    return (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm font-medium text-gray-700">{title}</p>
            {dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dataUrl} alt={`QR code for ${title}`} width={240} height={240} />
            ) : (
                <div className="flex h-[240px] w-[240px] items-center justify-center text-sm text-gray-400">
                    Generating…
                </div>
            )}
            <p className="max-w-[240px] break-all text-center text-xs text-gray-400">{url}</p>
        </div>
    );
}
```

- [ ] **Step 3: Manual verification**

This component is exercised by Task 13 and Task 14's pages; verification happens there.

- [ ] **Step 4: Commit**

```bash
git add apps/education-apps/frontend/components/QrCodeCard.tsx apps/education-apps/frontend/package.json apps/education-apps/frontend/package-lock.json
git commit -m "feat(frontend): add QR code display component"
```

---

## Task 13: Admin parents pages (list + detail with QR/regenerate)

**Files:**
- Create: `apps/education-apps/frontend/app/admin/parents/page.tsx`
- Create: `apps/education-apps/frontend/app/admin/parents/[id]/page.tsx`

Before writing these, read `apps/education-apps/frontend/app/admin/students/page.tsx` and `apps/education-apps/frontend/app/admin/teachers/page.tsx` to match this codebase's existing list-page layout, table styling, and modal/create-form conventions exactly — do not introduce a new visual pattern.

- [ ] **Step 1: Implement the list page**

Create `apps/education-apps/frontend/app/admin/parents/page.tsx` following the exact list/table/create-modal structure found in `app/admin/students/page.tsx` (same Tailwind classes, same loading/empty states, same `useEffect` + service-call pattern), swapping in `getParents`/`createParent` from `@/lib/services/parents` and columns: Name, Phone, Number of children (`students.length`), a "View" link to `/admin/parents/[id]`.

- [ ] **Step 2: Implement the detail page**

Create `apps/education-apps/frontend/app/admin/parents/[id]/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getParentById, regenerateParentToken } from '@/lib/services/parents';
import type { Parent } from '@/types';
import QrCodeCard from '@/components/QrCodeCard';

export default function ParentDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [parent, setParent] = useState<Parent | null>(null);
    const [rawToken, setRawToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getParentById(id).then((data) => {
            setParent(data);
            setLoading(false);
        });
    }, [id]);

    const handleRegenerate = async () => {
        const result = await regenerateParentToken(id);
        setParent(result.parent);
        setRawToken(result.rawToken);
    };

    if (loading) return <div className="p-6">Loading…</div>;
    if (!parent) return <div className="p-6">Parent not found</div>;

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-xl font-semibold">{parent.name}</h1>
                <p className="text-gray-500">{parent.phone}</p>
            </div>

            <div>
                <h2 className="mb-2 font-medium">Children</h2>
                <ul className="space-y-1">
                    {parent.students.map((student) => (
                        <li key={student.id}>
                            <a className="text-blue-600 hover:underline" href={`/admin/students/${student.id}`}>
                                {student.name} {student.surname}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="space-y-3">
                <button
                    className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    onClick={handleRegenerate}
                >
                    Regenerate access QR
                </button>
                {rawToken && (
                    <QrCodeCard
                        title="New parent access link — save or print now, it will not be shown again"
                        url={`${process.env.NEXT_PUBLIC_FRONTEND_URL || ''}/p/${rawToken}`}
                    />
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Manual verification**

Run: `cd apps/education-apps && npm run dev` (backend) and, in another terminal, `cd apps/education-apps/frontend && npm run dev` (frontend).

1. Log in as admin at `http://localhost:3001/login`.
2. Go to `/admin/parents`, create a test parent.
3. Open the parent's detail page, click "Regenerate access QR".
4. Confirm a QR image renders and the URL text below it matches `/p/{token}` format.

- [ ] **Step 4: Commit**

```bash
git add apps/education-apps/frontend/app/admin/parents
git commit -m "feat(frontend): add admin parent list and detail pages with QR regeneration"
```

---

## Task 14: Student profile page (admin-facing)

**Files:**
- Create: `apps/education-apps/frontend/app/admin/students/[id]/page.tsx`

Before writing this, read `apps/education-apps/frontend/app/admin/students/page.tsx` for existing conventions (data fetching pattern, Tailwind styling) and reuse `getStudentById` from `@/lib/services/students` (already returns `inscriptions`, `payments`, `attendances` per the backend's `getStudentById` include — see Task context).

- [ ] **Step 1: Implement the page**

Create `apps/education-apps/frontend/app/admin/students/[id]/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getStudentById, regenerateStudentToken } from '@/lib/services/students';
import type { Student } from '@/types';
import QrCodeCard from '@/components/QrCodeCard';

type Tab = 'attendance' | 'finance' | 'inscriptions' | 'info';

export default function StudentProfilePage() {
    const { id } = useParams<{ id: string }>();
    const [student, setStudent] = useState<Student | null>(null);
    const [tab, setTab] = useState<Tab>('attendance');
    const [rawToken, setRawToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getStudentById(id).then((data) => {
            setStudent(data);
            setLoading(false);
        });
    }, [id]);

    const handleRegenerate = async () => {
        const result = await regenerateStudentToken(id);
        setStudent(result.student);
        setRawToken(result.rawToken);
    };

    if (loading) return <div className="p-6">Loading…</div>;
    if (!student) return <div className="p-6">Student not found</div>;

    const balanceDue =
        (student.inscriptions || []).reduce((sum: number, i: any) => sum + i.amount, 0) -
        (student.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold">{student.name} {student.surname}</h1>
                    <p className="text-gray-500">{student.schoolLevel}</p>
                </div>
                <button
                    className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    onClick={handleRegenerate}
                >
                    Regenerate attendance QR
                </button>
            </div>

            {rawToken && (
                <QrCodeCard
                    title="New student attendance token — for staff scanning only"
                    url={rawToken}
                />
            )}

            <div className="flex gap-4 border-b border-gray-200">
                {(['attendance', 'finance', 'inscriptions', 'info'] as Tab[]).map((t) => (
                    <button
                        key={t}
                        className={`pb-2 capitalize ${tab === t ? 'border-b-2 border-blue-600 font-medium' : 'text-gray-500'}`}
                        onClick={() => setTab(t)}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {tab === 'attendance' && (
                <ul className="space-y-1">
                    {(student.attendances || []).map((a: any) => (
                        <li key={a.id}>
                            {new Date(a.date).toLocaleDateString()} — {a.status}
                        </li>
                    ))}
                </ul>
            )}

            {tab === 'finance' && (
                <div>
                    <p className="mb-2 font-medium">Balance due: {balanceDue} MAD</p>
                    <ul className="space-y-1">
                        {(student.payments || []).map((p: any) => (
                            <li key={p.id}>
                                {new Date(p.date).toLocaleDateString()} — {p.amount} MAD ({p.method})
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {tab === 'inscriptions' && (
                <ul className="space-y-1">
                    {(student.inscriptions || []).map((i: any) => (
                        <li key={i.id}>
                            {i.type} — {i.category} — {i.amount} MAD
                        </li>
                    ))}
                </ul>
            )}

            {tab === 'info' && (
                <div className="space-y-1">
                    <p>Phone: {student.phone || '—'}</p>
                    <p>CIN: {student.cin || '—'}</p>
                    <p>Address: {student.address || '—'}</p>
                    {student.parent ? (
                        <p>
                            Parent:{' '}
                            <a className="text-blue-600 hover:underline" href={`/admin/parents/${student.parent.id}`}>
                                {student.parent.name}
                            </a>
                        </p>
                    ) : (
                        <p>Parent: {student.parentName || '—'} ({student.parentPhone || '—'})</p>
                    )}
                </div>
            )}
        </div>
    );
}
```

Note: `getStudentById` on the backend already includes `inscriptions`, `payments`, `attendances` (see `students.service.ts`); it does not currently include `parent`. Modify `getStudentById` in `apps/education-apps/src/modules/students/students.service.ts` to add `parent: true` to its `include` object so `student.parent` is populated.

- [ ] **Step 2: Manual verification**

With both servers running (per Task 13 Step 3):
1. Go to `/admin/students`, open any existing student.
2. Confirm the profile page loads with the four tabs, and each tab shows the expected (possibly empty) data.
3. Click "Regenerate attendance QR" and confirm a QR renders.

- [ ] **Step 3: Commit**

```bash
git add apps/education-apps/frontend/app/admin/students/\[id\] apps/education-apps/src/modules/students/students.service.ts
git commit -m "feat(frontend): add student profile page with attendance/finance/inscriptions/info tabs"
```

---

## Task 15: Public parent profile page (magic link)

**Files:**
- Create: `apps/education-apps/frontend/app/p/[token]/page.tsx`

This route is intentionally **outside** the `app/admin` tree — the existing admin layout wraps pages with authenticated navigation (sidebar, `RequireAuth`); this page must not go through that, since parents have no login. Read `apps/education-apps/frontend/app/layout.tsx` first to confirm nothing at the root layout forces an auth redirect — if it does, this task also needs an early-return guard in that layout for paths starting with `/p/`.

- [ ] **Step 1: Implement the page**

Create `apps/education-apps/frontend/app/p/[token]/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPublicParentProfile } from '@/lib/services/parents';
import type { Parent } from '@/types';

const statusBadge = (status: 'PRESENT' | 'LATE' | 'ABSENT' | undefined) => {
    if (status === 'PRESENT') return '✅ Present';
    if (status === 'LATE') return '⏰ Late';
    if (status === 'ABSENT') return '❌ Absent';
    return '— No record today';
};

export default function ParentPublicProfilePage() {
    const { token } = useParams<{ token: string }>();
    const [parent, setParent] = useState<Parent | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        getPublicParentProfile(token).then(setParent).catch(() => setError(true));
    }, [token]);

    if (error) return <div className="p-6 text-center text-red-600">Link not found or expired.</div>;
    if (!parent) return <div className="p-6 text-center">Loading…</div>;

    const totalBalanceDue = parent.students.reduce((sum, student: any) => {
        const due =
            (student.inscriptions || []).reduce((s: number, i: any) => s + i.amount, 0) -
            (student.payments || []).reduce((s: number, p: any) => s + p.amount, 0);
        return sum + due;
    }, 0);

    return (
        <div className="mx-auto max-w-md p-6 space-y-6">
            <div>
                <h1 className="text-xl font-semibold">{parent.name}</h1>
                <p className="text-gray-500">{parent.students.length} children</p>
                <p className="mt-1 text-sm font-medium">Total balance due: {totalBalanceDue} MAD</p>
            </div>

            <div className="space-y-3">
                {parent.students.map((student: any) => {
                    const todayAttendance = (student.attendances || []).find(
                        (a: any) => new Date(a.date).toDateString() === new Date().toDateString()
                    );
                    const due =
                        (student.inscriptions || []).reduce((s: number, i: any) => s + i.amount, 0) -
                        (student.payments || []).reduce((s: number, p: any) => s + p.amount, 0);

                    return (
                        <div key={student.id} className="rounded-lg border border-gray-200 p-4">
                            <p className="font-medium">{student.name} {student.surname}</p>
                            <p className="text-sm text-gray-500">{statusBadge(todayAttendance?.status)}</p>
                            <p className="text-sm text-gray-500">Balance due: {due} MAD</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
```

Note: the public profile endpoint (`getParentByRawToken` in `parents.service.ts`) currently includes only `students: true` (flat), not each student's `inscriptions`/`payments`/`attendances`. Modify `getParentByRawToken` in `apps/education-apps/src/modules/parents/parents.service.ts` to:

```ts
export const getParentByRawToken = async (rawToken: string) => {
    const accessTokenHash = hashToken(rawToken);

    return prisma.parent.findUnique({
        where: { accessTokenHash },
        include: {
            students: {
                include: { inscriptions: true, payments: true, attendances: true },
            },
        },
    });
};
```

Update the corresponding test in `parents.service.test.ts` (Task 6) to expect this nested `include` shape instead of the flat one:

```ts
expect(prisma.parent.findUnique).toHaveBeenCalledWith({
    where: { accessTokenHash: 'some-hash' },
    include: {
        students: {
            include: { inscriptions: true, payments: true, attendances: true },
        },
    },
});
```

- [ ] **Step 2: Re-run backend tests**

Run: `cd apps/education-apps && npm test -- parents.service`
Expected: still passing after the test update above.

- [ ] **Step 3: Manual verification**

1. From an admin parent detail page, regenerate a token and copy the printed URL's token.
2. Open `http://localhost:3001/p/{token}` in a private/incognito window (no login).
3. Confirm the parent's name, children, today's status, and balances render.
4. Try a garbage token at `/p/not-a-real-token` and confirm the "Link not found or expired" message shows instead of a crash.

- [ ] **Step 4: Commit**

```bash
git add apps/education-apps/frontend/app/p apps/education-apps/src/modules/parents
git commit -m "feat(frontend): add public parent magic-link profile page"
```

---

## Task 16: Staff attendance scan screen

**Files:**
- Create: `apps/education-apps/frontend/app/admin/attendance/scan/page.tsx`

- [ ] **Step 1: Install the browser QR scanning library**

Run: `cd apps/education-apps/frontend && npm install html5-qrcode`

- [ ] **Step 2: Implement the screen**

Create `apps/education-apps/frontend/app/admin/attendance/scan/page.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { getGroups } from '@/lib/services/groups';
import { scanAttendance } from '@/lib/services/attendance';
import type { Group } from '@/types';

export default function AttendanceScanPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [lastResult, setLastResult] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        getGroups().then(setGroups);
    }, []);

    useEffect(() => {
        if (!selectedGroupId) return;

        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        scanner
            .start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: 250 },
                async (decodedText) => {
                    try {
                        const attendance = await scanAttendance(decodedText, selectedGroupId);
                        setLastResult(`Marked ${attendance.status}`);
                    } catch (error: any) {
                        setLastResult(error?.response?.data?.error || 'Scan failed');
                    }
                },
                () => {
                    // ignore per-frame decode failures — expected while camera searches for a code
                }
            )
            .catch(() => setLastResult('Camera failed to start'));

        return () => {
            scanner.stop().catch(() => undefined);
        };
    }, [selectedGroupId]);

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-xl font-semibold">Scan attendance</h1>

            <select
                className="rounded border border-gray-300 px-3 py-2"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
            >
                <option value="">Select a group…</option>
                {groups.map((group: any) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                ))}
            </select>

            {selectedGroupId && <div id="qr-reader" className="mx-auto max-w-sm" />}

            {lastResult && <p className="text-center font-medium">{lastResult}</p>}
        </div>
    );
}
```

Before finalizing this task, read `apps/education-apps/frontend/lib/services/groups.ts` to confirm the exported function name for fetching all groups (it may not be named `getGroups`) — adjust the import and call in this file to match whatever that file actually exports.

- [ ] **Step 3: Manual verification**

1. Add a link to this page from the sidebar (`apps/education-apps/frontend/components/Sidebar.tsx` or wherever the existing nav lives — follow the pattern used for the other admin nav entries) so it's reachable in the browser.
2. Log in as admin, navigate to `/admin/attendance/scan`, select a group with an enrolled student who has a regenerated token.
3. Print or display that student's QR (from Task 14) on a second screen or phone, and scan it with the device running this page.
4. Confirm the result message shows `Marked PRESENT` or `Marked LATE`, and confirm the console (backend terminal) logs the `ConsoleNotificationProvider` message.
5. Scan the same code again immediately — confirm the result message shows the "already marked" error, not a duplicate record.

- [ ] **Step 4: Commit**

```bash
git add apps/education-apps/frontend/app/admin/attendance/scan apps/education-apps/frontend/package.json apps/education-apps/frontend/package-lock.json apps/education-apps/frontend/components/Sidebar.tsx
git commit -m "feat(frontend): add staff QR attendance scan screen"
```

---

## Task 17: End-to-end manual QA pass

**Files:** none (verification only)

- [ ] **Step 1: Full happy path**

With both servers running:
1. Create a parent, then create a student linked to that parent (via whatever student-create flow exists — if the create form doesn't yet expose a parent picker, link them directly through `PUT /api/students/:id` with `{ "parentId": "<id>" }` using curl/Postman for this QA pass).
2. Enroll the student in a group that has a `timeSlots` entry for today.
3. Regenerate and note the student's raw token and the parent's raw token.
4. As staff, scan the student's token for that group on the scan screen — confirm `PRESENT`/`LATE` as expected for the current time vs. the slot.
5. Open the parent's `/p/{token}` link in an incognito window — confirm today's status and balance show correctly for that child.
6. Manually trigger `runAbsenceSweep` for a different enrolled student who was never scanned (temporarily set the group's `timeSlots` end time to a few minutes in the past, wait for the cron tick or call the function directly via a throwaway `ts-node` one-liner), and confirm an `ABSENT` row and console notification appear.

- [ ] **Step 2: Report results**

Note any failures found during this pass as follow-up items — do not silently patch and re-claim success without re-running the specific step that failed.

---

## Self-Review Summary

- **Spec coverage:** Parent model (Task 2), passwordless magic-link parent access with hashed tokens + rate limiting (Task 6), staff-only student QR scanning (Task 7 + 8), late/present derivation from `Group.timeSlots` (Task 4 + 8), duplicate-scan prevention (Task 2's unique index + Task 8), auto-absence sweep (Task 9), parent notifications (Task 5, wired into Task 8 and Task 9), audit log (Task 10), admin token regeneration UI (Task 13, 14), student profile page (Task 14), parent profile page (Task 15), staff scan screen (Task 16). All spec sections have a corresponding task.
- **Type consistency:** `AttendanceStatus` (`PRESENT`/`LATE`/`ABSENT`) is used identically across Task 2 (schema), Task 4 (`deriveAttendanceStatus` return type), Task 8 (`scanAttendance`), Task 9 (absence sweep), and the frontend `Attendance` type in Task 11 — verified consistent.
- **No backfill:** confirmed as an explicit non-goal; no task touches existing student rows' legacy parent fields.
