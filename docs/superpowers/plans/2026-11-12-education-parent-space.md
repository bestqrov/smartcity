# Parent space and parent links: implementation plan (project A)

> Executed with superpowers:subagent-driven-development. The spec is the source of truth:
> `docs/superpowers/specs/2026-11-12-education-parent-space-design.md`.

**Goal:** Give parents an app-like space at `/p/[token]` (French and Arabic, installable on a phone) and give staff an "Accès parents" page to send links by WhatsApp and to print QR cards.

**Branch:** `feat/education-parent-space`.

## Task 1: Backend (TDD, jest with prisma mocked)

1. **Schema.** Add `linkIssuedAt DateTime?` to `Parent`. Then run `npx prisma validate && npx prisma generate && npx prisma db push`.
2. **`linkIssuedAt`.**
   - Set it to `new Date()` in `createParent` and in `regenerateParentToken`.
   - Write it as `null` explicitly in the import's parent creation (`src/modules/students-import/importStudents.service.ts`).
3. **`getParentByRawToken`.** It must return the shape the spec describes.
   - Per student:
     - `groups` selected as `{ id, name, subject, level, timeSlots, teacher: { select: { name: true } } }`;
     - `attendances` from the last 60 days, sorted `date desc, slotStart desc`.
   - Then, from `parent.branchId`:
     - `announcements`: active, `createdAt desc`, take 10;
     - `holidays`: active, `endDate >= now`, `startDate asc`;
     - `school`: `{ name, logo, phone, email }`, through the branch.
   - A parent with no `branchId` gets `[]`, `[]` and `null`.
   - `stripTokenHashes` must still remove every token hash, including the students' `portalTokenHash` if it is present.
4. **`POST /parents/links`** with body `{ parentIds }`:
   - It accepts an array of 1 to 200 distinct non-empty strings; anything else is a 400.
   - It loads the parents by `id in parentIds` and `branchId`. If any id is missing, it throws "Parent not found" and writes nothing.
   - Otherwise it runs one `$transaction`: for each parent, update `accessTokenHash` with a fresh token and set `linkIssuedAt`.
   - It returns `[{ id, rawToken }]`.
5. **`GET /parents/access`:**
   - It loads the parents of the branch with `id`, `name`, `phone`, `whatsapp`, `linkIssuedAt`, and `students: { where: { branchId }, select: { id, name, surname } }`.
   - It runs one `accessLog.groupBy({ by: ['parentId'], where: { parentId: { in: ids } }, _max: { accessedAt: true } })`.
   - It returns the parents with `lastVisitAt`, sorted by name.
6. **Routes.** Register both routes **before** `/:id`, using the existing middleware (ADMIN, SECRETARY, OWNER, with tenantScope).
7. **Tests** cover every rule in the spec's Testing section.

## Task 2: Parent space frontend (`frontend/app/p/[token]`)

Rewrite the page as the spec describes. Files:
- `lib/parent/messages.ts`: `fr` and `ar` objects with the same keys; `ar` is Modern Standard Arabic.
- `lib/parent/useParentLang.ts`: storage key `parent-lang`.
- `components/parent/*`:
  - `ParentShell`: top bar, child switcher, bottom tabs, RTL handling;
  - one component per tab: `HomeTab`, `AttendanceTab`, `PaymentsTab`, `SchoolTab`;
  - `InstallBanner`.
- `app/p/[token]/manifest.webmanifest/route.ts`: a GET route handler that returns JSON with `name`/`short_name` "Espace parent", `start_url` and `scope` set to `/p/<token>`, `display: standalone`, theme colours, and the icon `/icon.jpg`. The page links it in its head with `<link rel="manifest">`. The page is a client component, so the link is added in a small `layout.tsx` for `app/p/[token]` using `generateMetadata` → `manifest`.
- Extend the frontend `Parent` and `Student` types for the new fields.

Reuse `ATTENDANCE_META` for colours, with labels from the messages file. Use `whatsappNumber` and `publicUrl` from `lib/publicUrl.ts`.

**Verify:** `npx tsc --noEmit`. **Do not run `npm run build`**, because the dev server on port 3011 is running.

## Task 3: "Accès parents" admin page

Files:
- `lib/services/parents.ts`: add `getParentsAccess()` and `issueParentLinks(ids)`.
- `app/admin/parents/access/page.tsx`: the table/cards with filters, the per-row WhatsApp action (confirm, regenerate, open wa.me, refresh), and selection plus "Imprimer les cartes QR".
- `components/parent/QrCardsPrint.tsx`: a print view rendered in a full-screen overlay, with `@media print` CSS (8 cards per A4 page; only the cards are printed). It uses the `qrcode` package that is already a dependency.
- `components/Sidebar.tsx`: add a "Parents" entry with sub-items "Liste des parents" (`/admin/parents`) and "Accès parents" (`/admin/parents/access`) for the admin. For the secretary, add `app/secretary/parents/access/page.tsx`, which reuses the same component, and a matching sidebar entry.
- The admin parents list page gets a link to "Accès parents".

**Verify:** `npx tsc --noEmit`.

## Task 4: Review, then a manual check on localhost:3011.
