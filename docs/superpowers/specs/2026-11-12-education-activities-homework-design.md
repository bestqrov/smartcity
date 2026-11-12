# Education: school activities (C) and homework (D)

**Date:** 2026-11-12
**App:** ArwaEduc (`apps/education-apps`)
**Roadmap:** the last two parts of A–D. Both projects appear in the parent space (`/p/[token]`) and use the notification dispatcher (`notify`) that was just built.

## C: Activities and events

### Problem

Schools organise outings, celebrations, sports days and open days. Today they announce them on paper or in WhatsApp groups, collect consent slips by hand, and lose track of who is coming and who has paid.

### Data

```prisma
model Activity {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  branchId    String   @db.ObjectId
  title       String
  description String?
  startAt     DateTime
  endAt       DateTime?
  location    String?
  price       Float?               // null/0 = free
  needsConsent Boolean @default(true) // parents must answer yes/no
  deadline    DateTime?            // last day to answer
  audience    String   @default("ALL") // ALL | GROUPS
  groupIds    String[] @db.ObjectId    // when audience = GROUPS
  coverImage  String?              // data URL (≤ 1 MB after client-side resize)
  published   Boolean  @default(false)
  notifiedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  responses   ActivityResponse[]
  @@index([branchId, startAt])
  @@map("activities")
}

model ActivityResponse {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  activityId String   @db.ObjectId
  activity   Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  studentId  String   @db.ObjectId
  parentId   String?  @db.ObjectId
  branchId   String   @db.ObjectId
  answer     String               // YES | NO
  paid       Boolean  @default(false) // marked by staff
  note       String?
  answeredAt DateTime @default(now())
  @@unique([activityId, studentId])
  @@map("activity_responses")
}
```

**Photos.** Each activity has one cover image. A gallery is out of scope for now: there is no file storage service yet, and images stored as data URLs are kept small.

### Staff page: `/admin/activities` (and the secretary twin)

- Two lists, "À venir" and "Passées". Each card shows the cover, the date, the audience, and counters: Oui / Non / Sans réponse / Payé.
- The create/edit form:
  - title, description, start and end, location, optional price, needs consent, deadline;
  - audience: the whole branch, or chosen groups;
  - a cover image, resized in the browser to at most 1280px and 1 MB.
- **Publish** makes the activity visible to parents and notifies them once (kind `ACTIVITY`, which is a new kind).
- The detail view lists every targeted student with the parent's answer and a "Payé" checkbox, which staff tick when cash is received. It has an "Exporter Excel" button, and a "Relancer les sans réponse" button that re-notifies parents who have not answered.

### Parent space

- On the Home tab, the next activity appears as a card with its cover.
- A new **"Activités"** section sits in the École tab, so the bar stays at 5 tabs. It lists upcoming and past activities with their details.
- For an activity that needs consent, the parent sees "Participera ✔ / Ne participera pas ✘" buttons per child until the deadline. After that the answer is locked and shown.
- The price and the paid status are shown too.
- There is a new public route, `POST /api/parents/activity-response/:token` with body `{ activityId, studentId, answer }`. The student must be the parent's child and must be in the activity's audience. The activity must be published and not past its deadline.

## D: Homework

### Data

```prisma
model Homework {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  branchId    String   @db.ObjectId
  groupId     String   @db.ObjectId
  subject     String
  title       String
  details     String?
  dueDate     DateTime
  createdBy   String?            // "teacher:<id>" | "user:<id>"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([branchId, groupId, dueDate])
  @@map("homeworks")
}
```

### Who posts

- **Teachers** post from the teacher space (`/t/[token]`). Each group gets a new "Devoirs" tab next to "Évaluations". It lists homework by due date, with create, edit and delete.
- **Staff** use `/admin/homework`: pick a group, then the same component.
- Creating homework notifies the parents of the group's students (kind `HOMEWORK`, new). Parents can turn this off with the Settings toggle `sendHomework`, which is added to `WhatsappChannel`. Push is always sent.

### Parent space

- On the Home tab, a **"Devoirs"** card shows homework due today and tomorrow.
- The full list sits at the top of the **Notes** tab, which is renamed **"Scolarité"** and becomes homework first, then grades. The bottom bar stays at 5 tabs. This tab is shown whenever a child has homework or grades.
- **Done ticking is local only.** Parents and children can tick homework as done in their own browser (`localStorage`). It is not stored on the server, because that would turn it into a tracking feature.

## Rules (both)

- Every query is branch-scoped.
- A teacher can only touch homework for their own groups, using the grades-portal scope pattern.
- Parents see only published activities whose audience includes their child, and homework for their child's groups whose due date falls between 14 days ago and 60 days ahead.

## Testing

- **Jest:**
  - activity audience resolution;
  - the response route: ownership, deadline, audience and upsert;
  - publishing notifies once;
  - the homework teacher scope and notify-on-create;
  - the parent profile includes the right items.
- **Frontend:** `tsc`, then a manual check on localhost.
