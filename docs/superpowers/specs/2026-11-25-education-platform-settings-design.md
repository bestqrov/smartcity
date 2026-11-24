# ArwaEduc — Super admin platform settings and broadcasts (design)

Date: 2026-11-25. Status: approved in conversation, waiting for spec review.

## Goal

The super admin (SA) controls the platform from the app, without code changes. They can also send an offer or any message to every school owner by email and WhatsApp, chosen by filters.

## 1. Platform settings (new singleton `PlatformSettings`)

There is one document, created on first read with the current values as defaults. Nothing changes until the SA saves.

| Field | Default | Used by |
|---|---|---|
| `trialDays` Int | 15 | `schools.service` signup (replaces `TRIAL_DAYS`); the signup page text; the trial message in admin settings |
| `signupOpen` Boolean | true | The `POST /schools/signup` route answers 403 `SIGNUP_CLOSED` when closed; the signup page shows «Inscriptions fermées» |
| `signupPeriods` String[] | MONTHLY, SEMIANNUAL, YEARLY | The period picker on the signup page; the backend refuses a period outside this list |
| `platformName` String | ArwaEduc | The login and signup headers |
| `supportPhone` / `supportWhatsapp` / `supportEmail` | current hardcoded values | The login page (WhatsApp link), the signup page (email), the trial-expired message |
| `bannerText` String? and `bannerActive` Boolean | null / false | A banner at the top of every school staff dashboard (admin and secretary) |

Routes:
- `GET /api/platform/settings` for SA.
- `PUT /api/platform/settings` for SA, validated: trialDays 1–90, and the email and phone formats are checked.
- `GET /api/public/platform` is public and rate-limited. It returns only the public fields: name, support contacts, signupOpen, signupPeriods and trialDays. The banner goes to authenticated staff through `/schools/me`, or a small `/api/platform/banner` route for staff.

Frontend: a new SA page **«Paramètres de la plateforme»** (`/admin/platform/settings`), with an entry in the SA menu and four cards: Inscription & essai, Identité & contact, Bannière, WhatsApp plateforme.

## 2. Full control of a school (SA)

An **«Modifier»** button on the SA schools page opens a dialog with:
- **School and owner information:** school name, owner name, owner email, owner phone, city, address. Email uniqueness is checked against User. When the email changes, the owner User's email changes too.
- **Institution type.**
- **Trial end date:** set a date, or the shortcut «+7 / +15 / +30 jours».
- **Reset the owner's password:** the SA types the new password, which is never shown again or logged.

Routes:
- `PATCH /api/schools/:id` (SA) for the information, type and trial.
- `PATCH /api/schools/:id/owner-password` (SA).

## 3. Broadcasts to school owners (email + WhatsApp)

### Channels
- **WhatsApp:** this reuses Evolution with a platform instance `arwa-platform`. The SA connects their own number by QR code from the settings page, the same way schools do, and the existing QR component is reused. The channel is stored in a new `PlatformWhatsapp` singleton (instance, status, phone).
- **Email:** sent over SMTP with nodemailer. The env variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `SMTP_FROM` are set in Coolify. `.env.example` gets empty placeholders. When SMTP is not configured, the page says so and the email channel is disabled.

### Model
- `Broadcast`: id, subject, body, channels (EMAIL/WHATSAPP), filters (JSON), counts (total/sent/failed per channel), createdAt, createdBy.
- `BroadcastMessage`: broadcastId, schoolId, channel, `to`, status PENDING/SENDING/SENT/FAILED/SKIPPED, error, attempts, sentAt.
  - This is a separate queue from the parents' `OutboundMessage`, so per-branch rules and retention stay untouched.

### Sending
- The existing notification worker loop also processes `BroadcastMessage`.
  - WhatsApp: one message every ~8 s, to avoid bans.
  - Email: batches of 10 per tick.
  - Each message is tried 3 times, with a backoff between tries.
- A school without a phone or email for a channel is recorded as SKIPPED, with its reason.
- The text can use the placeholders `{ecole}` and `{proprietaire}`, which are filled in per school.
- An opt-out line is appended to emails: «Pour ne plus recevoir ces messages, répondez STOP». There is no opt-out automation in phase 1.

### Filters
- School status: trial in progress, trial expired, active, suspended.
- Pack.
- Institution type.
- Sales agent.
- The page shows the recipient count before sending, split by channel.

### Page
The SA page **«Messages aux écoles»** (`/admin/platform/broadcasts`) has:
- a composer (subject, body, channels, filters, preview, count);
- a confirmation step («Envoyer à N écoles ?»);
- a history list with per-channel progress, opening into the per-school status, with a «Relancer les échecs» button.

Routes, all SA:
- `POST /api/platform/broadcasts/preview` returns the recipient counts.
- `POST /api/platform/broadcasts` creates the broadcast and queues the messages.
- `GET /api/platform/broadcasts` and `GET /api/platform/broadcasts/:id`.
- `POST /api/platform/broadcasts/:id/retry`.

## 4. School admin dashboard: change pack and send requests

On the school admin dashboard (ADMIN and OWNER), a new card **«Mon abonnement»** shows:
- the current pack, its options and its limits (students used out of the maximum);
- the trial end date or the status.

It has two actions:
- **«Changer de pack»** opens the existing `PackUpgradeDialog` in a "browse" mode that does not depend on reaching a limit.
  - Moving to a bigger pack is immediate, through the existing `upgradePack` flow (PackUpgrade plus a pending payment, as today).
  - Moving to a smaller pack does not happen in the app. It creates a request to the SA (see below), because of billing and the limits already in use.
- **«Demander une fonctionnalité»** opens a form with:
  - a type: Nouvelle fonctionnalité / Option du pack / Problème / Autre;
  - a message.

Requests are stored in a new model `SchoolRequest`. Its fields:
- `schoolId`, `branchId`, `byUserId`;
- `kind` (PACK_DOWNGRADE | FEATURE | PACK_OPTION | PROBLEM | OTHER);
- `message`, `targetPackId?`;
- `status` (NEW | IN_PROGRESS | DONE | REJECTED);
- `reply?`, `createdAt`, `updatedAt`.

On the SA side:
- A new page **«Demandes des écoles»** lists the requests with status filters. The SA can change the status and write a reply.
- A badge on the SA menu shows the number of NEW requests, using the same pattern as the pending payment declarations.

On the school side, the card lists the school's requests with their status and the SA reply.

Routes:
- `POST /api/school-requests` and `GET /api/school-requests/mine` for ADMIN and OWNER, tenant-scoped.
- `GET /api/platform/school-requests`, `GET /api/platform/school-requests/pending-count` and `PATCH /api/platform/school-requests/:id` (status and reply) for SA.

## Languages, security, tests
- Every SA page is in FR and AR, using the platform prefs/messages pattern of the existing SA pages.
- Every route is SA-only (`roleMiddleware('SUPER_ADMIN')`).
- SMTP and Evolution credentials are read from the env only. They are never returned or logged.
- No credentials go in docs.
- Jest tests cover:
  - settings validation and defaults;
  - signup using trialDays, signupOpen and signupPeriods;
  - the school edit, including email uniqueness;
  - broadcast recipient filtering, placeholder filling, the worker's broadcast processing (mocked mailer and Evolution) and retry;
  - role checks.

## Out of scope (phase 1)
- An automatic unsubscribe list.
- Scheduled sends.
- Attachments and images.
- Messages to parents or teachers. Broadcasts go to school owners only.
