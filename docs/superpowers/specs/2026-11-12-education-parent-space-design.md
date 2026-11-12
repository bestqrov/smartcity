# Education: modern parent space and parent link distribution (project A)

**Date:** 2026-11-12
**App:** ArwaEduc (`apps/education-apps`)
**Roadmap:** this is A of A–D. B is grades, C is activities and D is homework. Each is its own project. A builds the shell where B–D will appear later.

## Problem

Competing products give every family a phone-friendly space to follow their child. ArwaEduc already has a portal for each student (`/s/[token]`). The parent portal (`/p/[token]`) is one bare page that shows only today's attendance and a balance per child. There is also no practical way for a school to send its parents their links. A link can only be created one parent at a time from `/admin/parents/[id]`, and no menu item even leads there.

## Goal

1. A parent opens one link on their phone and gets an app-like space for all their children. It is in French or Arabic, and can be added to the home screen.
2. A school can send links to all its parents in minutes, by WhatsApp or as printed QR cards, and can see who received a link and who has opened it.

## Scope

**In scope:** only data that exists today:
- attendance;
- inscriptions and payments (tuition);
- groups, teachers and timetable;
- announcements;
- holidays;
- transport;
- crèche information;
- the school's contact details.

**Out of scope:**
- Grades, activities and homework (B, C, D).
- Push notifications.
- Parent login with a password. Access stays the secret link (`/p/<token>`), as today.
- Automatic WhatsApp sending through the WhatsApp Business API. The admin presses send in WhatsApp.

## Parent space (`/p/[token]`)

**Data.** `GET /parents/profile/:token` returns more than today, but nothing more sensitive.

- **Each child:**
  - `inscriptions`
  - `payments` (tuition only, as today)
  - `attendances` from the last 60 days, newest first
  - `groups`, each with `id`, `name`, `subject`, `level`, `timeSlots` and `teacher: { name }`. Only the teacher's name, never the full teacher record.
  - `transportSubscriptions`, as today
  - the crèche fields, as today
- **For the parent's branch:**
  - `announcements`: active ones, the 10 newest;
  - `holidays`: active ones, not yet over, soonest first;
  - `school`: `{ name, logo, phone, email }`.
- Token hashes are still stripped from the response, and every visit is still recorded in `AccessLog`.

**Layout.** Mobile first, with an app feel.

- **Top bar:**
  - school logo and name;
  - a FR/عربي toggle;
  - call and WhatsApp buttons for the school (WhatsApp goes through `whatsappNumber`).
- **Child switcher:** a row of chips with initials and first name. It shows only when the parent has two or more children. The selected child applies to every tab.
- **Bottom tab bar, four tabs:**
  - **Accueil:**
    - a large "today" card: the attendance status today, or "pas encore pointé";
    - the next session from the timetable (day, time, subject);
    - the balance due;
    - the latest announcement;
    - the next holiday.
  - **Présence:**
    - counters for the last 30 days: present, late, absent and justified;
    - a list grouped by day, with the session time and a status badge.
  - **Paiements:**
    - totals: owed, paid, balance;
    - the list of inscriptions and payments;
    - transport for the current month: paid or amount due;
    - the same note as today, that monthly fees may not be included.
  - **École:**
    - the groups with subject and teacher;
    - a weekly timetable grouped by day;
    - transport (route, stop, times, a call button for the driver);
    - crèche information (section, health notes, authorised pick-up);
    - all announcements;
    - all holidays;
    - the school's contact details.
- **Empty states:** every tab has one, for example "Aucun paiement enregistré".
- **Errors and loading:** a bad link shows a friendly "Lien introuvable ou expiré, demandez un nouveau lien à l'établissement". Loading shows a skeleton.

**Language.**
- French and Arabic, with the Arabic page right to left (`dir`).
- The default follows the browser language, and a saved choice always wins (same rule as `useLandingLang`, with its own storage key).
- Numbers, phone numbers and amounts are wrapped in `dir="ltr"`.
- Attendance labels are translated.

**Add to home screen.**
- Each link gets its own manifest at `/p/<token>/manifest.webmanifest`, so the installed app opens on that parent's space (`start_url: /p/<token>`). It uses the school-neutral name "Espace parent" and the app icon.
- A dismissible banner offers installation:
  - on Android it uses `beforeinstallprompt`;
  - on iOS Safari it shows a short "Partager → Sur l'écran d'accueil" hint.
- The dismissal is remembered in localStorage.

**Look.** Same Tailwind stack, light and dark (`dark:` with the system preference), large touch targets, a minimum width of 360px, no horizontal scroll.

## Parent access page (admin)

A new page, `/admin/parents/access`, titled "Accès parents". A new sidebar entry, **Parents**, leads to `/admin/parents` and `/admin/parents/access`. There is no Parents entry at all today.

**Table.**
- One row per parent of the branch: name, phone, children's names, "Lien créé le" (`linkIssuedAt`) and "Dernière visite" (the latest `AccessLog.accessedAt` for that parent).
- Filters: Tous / Sans lien / Lien jamais ouvert.
- It becomes cards at phone width.

**Actions per row: "Envoyer par WhatsApp".**
1. If a link already exists, the admin confirms first ("L'ancien lien ne fonctionnera plus"), because the token is shown only once and has to be regenerated.
2. The app regenerates the token.
3. It opens `https://wa.me/<whatsappNumber(whatsapp || phone)>?text=<message + link>` in a new tab.
4. It marks `linkIssuedAt`.

**Bulk action: "Imprimer les cartes QR".**
1. The admin selects parents. "Sélectionner les parents sans lien" is a shortcut.
2. One request regenerates every selected token (at most 200).
3. A print view opens: A4, 8 cards per page. Each card shows the school name, the parent's name, the children's names, a QR code, the short link, and a two-line instruction in French and Darija.
4. The admin prints with `window.print()`.
5. After a bulk print, a reminder says "Les anciens liens de ces parents ne fonctionnent plus".

**Data.**
- `Parent.linkIssuedAt DateTime?`. It is set whenever a token is created or regenerated: in `createParent`, `regenerateParentToken`, the bulk regenerate, and the import's parent creation, where it stays **null** because no link was handed out.
- New staff endpoint `POST /parents/links` with body `{ parentIds: string[] }` (1 to 200 ids):
  - Each id must belong to the caller's branch. If any does not, the request returns 400 and changes nothing.
  - It regenerates every token and sets `linkIssuedAt`.
  - It returns `[{ id, rawToken }]`.
- New staff endpoint `GET /parents/access`:
  - It returns the branch's parents with `id`, `name`, `phone`, `whatsapp`, `linkIssuedAt`, `lastVisitAt`, and `children: [{ id, name, surname }]`.
  - `lastVisitAt` comes from one aggregation over `AccessLog`, not one query per parent.
- Same roles as the other parents routes: ADMIN, SECRETARY, OWNER. The secretary gets the sidebar entry too.

## Testing

- **Backend (jest, prisma mocked):**
  - the profile includes the new fields and only the teacher's name;
  - attendances are limited to 60 days;
  - announcements, holidays and school come from the parent's branch;
  - a parent with no `branchId` gets empty lists and no school;
  - `POST /parents/links` checks the branch, enforces the 1–200 limit, sets `linkIssuedAt`, and returns raw tokens that hash to the stored values;
  - `GET /parents/access` builds `lastVisitAt` from the access logs.
- **Frontend:** `tsc`, plus a manual check on localhost of every tab in French and Arabic, light and dark, at 375px. Also check the WhatsApp button, the QR print view, and the install banner (Android Chrome emulation).
