# Education: parent notifications (Web Push and optional school WhatsApp)

**Date:** 2026-11-12
**App:** ArwaEduc (`apps/education-apps`)

## Problem

Parents should hear about the things that matter as they happen:
- absence and lateness;
- a new published grade;
- a new announcement.

The code already builds attendance messages, in `attendance.service.ts` and `absence-job.ts`. It sends them through `ConsoleNotificationProvider`, which only writes to the server log, so nothing reaches anyone.

## Decisions

- **Web Push for every school.** It is free, works on Android, and on iPhone (iOS 16.4+) once the parent space is added to the home screen. It needs a VAPID key pair (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) in the server `.env`, and the `web-push` npm library.
- **WhatsApp is opt-in, one number per school, through the user's Evolution API server.**
  - The server holds `EVOLUTION_API_URL` and `EVOLUTION_API_KEY` (the global key) in `.env`. Neither is ever sent to the browser or written in docs.
  - Each school that opts in gets its own Evolution instance, named `arwa-<branchId>`. The admin connects the school's phone by scanning a QR code in Settings.
  - Schools that don't connect keep today's manual `wa.me` buttons. Nothing changes for them.
- **Sending is throttled.** Evolution uses an unofficial WhatsApp protocol, so messages go out one at a time, at least 4 seconds apart per school, from a persisted queue.
- **Each school chooses what is sent**, per type: attendance, grades, announcements.

## Data

```prisma
model PushSubscription {        // one per parent device
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  parentId  String   @db.ObjectId
  branchId  String   @db.ObjectId
  endpoint  String   @unique
  p256dh    String
  auth      String
  lang      String   @default("fr")
  createdAt DateTime @default(now())
  @@index([parentId])
  @@map("push_subscriptions")
}

model WhatsappChannel {          // one per branch that opted in
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  branchId     String   @unique @db.ObjectId
  instance     String   @unique          // "arwa-<branchId>"
  status       String   @default("DISCONNECTED") // DISCONNECTED | CONNECTING | CONNECTED
  phone        String?                    // connected number, for display
  sendAttendance    Boolean @default(true)
  sendGrades        Boolean @default(true)
  sendAnnouncements Boolean @default(false)
  updatedAt    DateTime @updatedAt
  @@map("whatsapp_channels")
}

model OutboundMessage {          // queue + log for every notification attempt
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  branchId  String   @db.ObjectId
  parentId  String   @db.ObjectId
  channel   NotificationChannel           // PUSH | WHATSAPP
  kind      String                        // ATTENDANCE | GRADE | ANNOUNCEMENT
  to        String?                       // phone (WhatsApp) — null for push
  title     String?
  body      String
  url       String?                       // deep link into the parent space (push)
  status    String   @default("PENDING")  // PENDING | SENT | FAILED | SKIPPED
  error     String?
  attempts  Int      @default(0)
  sendAfter DateTime @default(now())
  sentAt    DateTime?
  createdAt DateTime @default(now())
  @@index([status, sendAfter])
  @@index([branchId, createdAt])
  @@map("outbound_messages")
}
```

`AttendanceNotification` stays as it is. The attendance flow keeps writing it, and the dispatcher replaces `ConsoleNotificationProvider`.

## Flow

### Dispatcher

`notify(parentIds, { kind, branchId, title, body, path })` loads each parent. For each one it:
- creates a PUSH message for each push subscription of the parent;
- creates one WHATSAPP message to `whatsapp || phone` (normalised to `212…`) **if** the branch's `WhatsappChannel` is `CONNECTED` and that kind is enabled.

Messages are only queued. A worker sends them.

### Worker

The worker runs inside the server process every 5 seconds, using the `node-cron` setup that already exists or `setInterval`. Each run:
- takes up to 20 PENDING messages whose `sendAfter` has passed;
- sends at most one WhatsApp message per branch per run, with 4 seconds or more since that branch's last send;
- sends push messages without a throttle.

Failure handling:
- A failure retries up to 3 times, with backoff (`sendAfter` moves to 1, then 5, then 15 minutes later).
- On the third failure the status becomes FAILED and `error` records why.
- A push endpoint that answers 404 or 410 means the subscription has expired. It is deleted and the message is marked SKIPPED.

### Triggers

- **Attendance:** wherever `sendAttendanceNotification` is called today, call `notify` too, with the same message text and the path `/p/<no token>`. The push click opens the parent's installed app, using the scope's `start_url`.
- **Grades:** when an evaluation goes from unpublished to published, by staff or by a teacher, notify the parents of the group's students that have a non-null score or are marked absent. One message per child and evaluation, for example "Nouvelle note — Maths · Contrôle 1 : 15/20".
- **Announcements:** when an announcement is created active, notify every parent of the branch, but only if `sendAnnouncements` is on for WhatsApp. Push is always sent.

### Message language

- Push uses the subscription's `lang`. The parent's language choice is sent when they subscribe.
- WhatsApp sends French and Arabic together in one message, as `parentPortalMessage` already does.

## Parent side (`/p/[token]`)

- `public/sw.js` is a service worker that shows the notification and focuses or opens `start_url` on click.
- **"Activer les notifications"** appears as a card on the Accueil tab when `Notification.permission` is `default` and push is supported.
  - On iOS it appears only when the app runs installed (`display-mode: standalone`). Otherwise the existing install banner explains to install first.
  - On click, the app asks for permission, subscribes with the VAPID public key from `GET /api/push/public-key`, and `POST`s to `/api/push/subscribe/:token` the body `{ subscription, lang }`.
- A small switch in the École tab lets the parent turn notifications off. That runs `DELETE /api/push/subscribe/:token` with the `endpoint`.

## School side

**Settings, "WhatsApp automatique" card** (ADMIN, OWNER)

- **Disconnected:** a short explanation and the risk note ("numéro de l'établissement, envois espacés") with a "Connecter WhatsApp" button.
  1. The button creates the Evolution instance if it is missing.
  2. It fetches the QR code and shows it.
  3. The page polls the status every 3 seconds until it is CONNECTED, then shows the connected number.
- **Connected:**
  - toggles for absences/retards, notes and annonces;
  - "Envoyer un message test" to the admin's own phone, typed in;
  - "Déconnecter", which logs out the Evolution instance.
- **"Derniers envois":** the last 50 OutboundMessages of the branch, with channel, kind, recipient, status and error.
- If `EVOLUTION_API_URL` is not configured, the card reads "WhatsApp automatique non disponible" and the rest still works.

## Evolution API calls (v2)

All calls send the header `apikey: EVOLUTION_API_KEY` to `EVOLUTION_API_URL`.

| Action | Call |
|---|---|
| Create the instance | `POST /instance/create`, body `{ instanceName, integration: "WHATSAPP-BAILEYS", qrcode: true }` |
| Get the QR code | `GET /instance/connect/{instance}`, which returns `{ base64 }` or `{ code }` |
| Get the status | `GET /instance/connectionState/{instance}`, which returns `{ instance: { state: "open" \| "connecting" \| "close" } }` |
| Send a text | `POST /message/sendText/{instance}`, body `{ number: "2126…", text }` |
| Log out | `DELETE /instance/logout/{instance}` |

All of this is wrapped in `evolution.client.ts`, which uses fetch and a 15-second timeout. Its responses are parsed defensively.

## Testing

**Jest, with prisma mocked and fetch or web-push mocked:**
- the dispatcher fan-out rules: no WhatsApp when the channel is disconnected or the kind is off, and push for every subscription;
- the worker: the per-branch WhatsApp throttle, retry and backoff, expired push endpoints, and FAILED after 3 attempts;
- the Evolution client request shapes;
- the triggers: publishing notifies parents once, and re-publishing after unpublishing does not notify again (guarded by an `Evaluation.notifiedAt`);
- the subscribe and unsubscribe token routes.

**Manual:** with VAPID keys set, allow notifications in the parent space on localhost and publish a grade; a push arrives. WhatsApp is tested only once the user has set the Evolution env.

## Out of scope

- SMS.
- Parents replying through the app.
- Scheduled reminders such as unpaid fees. That one is a natural next step.
