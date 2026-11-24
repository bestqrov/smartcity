# Education: complete private school — professional inscription (phase 1)

**Date:** 2026-11-24
**App:** ArwaEduc (`apps/education-apps`)
**Roadmap:** phase 1 of 3 for "complete private schools". Phase 2 = online pre-inscription (public link per school → requests list → convert). Phase 3 = préscolaire daily log (`DAILY_LOG` option). Each phase has its own spec.

## Problem

Most Moroccan private schools are one institution on one campus that runs several cycles, often préscolaire + primaire, sometimes up to the lycée. The reference school is Riad Alghazali in Guelmim, which runs préscolaire + primaire. Its online pre-inscription asks for: name, date of birth, level, school year, address, transport yes/no, guardian, and phone. Its levels are « السنة الأولى/الثانية/الثالثة روض » and « السنة الأولى … السادس ابتدائي ».

ArwaEduc does not fit this kind of school today.

- A `PRIVATE_SCHOOL` registers students with the **tutoring form**: the student picks subjects, and each subject has its own price. A private school bills by **level** instead: an inscription fee, a monthly fee and an annual insurance, with every subject included.
- **Préscolaire does not exist as a level.** The crèche fields (health, authorized pickup) only exist for the `CRECHE` type.
- **The inscription is missing what a school office records:** the Arabic name (Massar uses it), sex, Massar code, father and mother details (CIN, phone, profession), emergency contact, health record, and the documents handed in.
- **Unpaid monthly fees cannot be followed.** There is no "who has not paid November" view for tuition. Transport has one, but tuition does not.

## Goal

A private school can declare its cycles, set its fees per level, and register a student with a complete, professional file. The fees are computed automatically, and the school can print an inscription file. Then, month after month, it can see who has paid tuition and who has not.

## Decisions

- **Opt-in per branch, `PRIVATE_SCHOOL` only.**
  - The new mode turns on when the branch's settings list at least one cycle (`Settings.schoolCycles`).
  - With no cycle set (every existing school today), nothing changes: the tutoring form, the subject prices and the student file stay the same.
  - `TUTORING_CENTER`, `VOCATIONAL_TRAINING`, `LANGUAGE_CENTER` and `CRECHE` are untouched.
- **One fixed level catalog, shared by the frontend and the backend.**
  - Codes are stable, and labels exist in FR and AR. The school only chooses its cycles; it does not type its levels.

  | Cycle | Codes | FR label | AR label |
  |---|---|---|---|
  | `PRESCOLAIRE` | `PS1` `PS2` `PS3` | 1ère / 2ème / 3ème année préscolaire | السنة الأولى / الثانية / الثالثة روض |
  | `PRIMAIRE` | `P1` … `P6` | 1ère … 6ème année primaire (1AP…6AP) | السنة الأولى … السادسة ابتدائي |
  | `COLLEGE` | `C1` `C2` `C3` | 1ère / 2ème / 3ème année collège (1AC…3AC) | السنة الأولى / الثانية / الثالثة إعدادي |
  | `LYCEE` | `TC` `B1` `B2` | Tronc commun, 1ère Bac, 2ème Bac | الجذع المشترك، الأولى باك، الثانية باك |

  - The lycée tracks (Sciences, Lettres…) are not levels. They are the group or class the student is put in.
- **Fees are set per level, in a new model, not in `Pricing`.**
  - `TuitionFee` has one row per (branch, level): `inscriptionFee`, `monthlyFee`, `insuranceFee` (annual).
  - `Pricing` stays as it is for tutoring subjects and vocational training.
- **The student's monthly fee is frozen at inscription.**
  - `Student.monthlyFee` keeps the amount agreed that day, after any sibling discount.
  - Changing the fee grid later never changes what existing students owe, the same rule as transport.
- **Monthly tuition dues reuse `Payment.forMonth`**, which transport already uses.
  - A tuition payment for a month has `forMonth: "YYYY-MM"` and `transportSubscriptionId: null`.
  - The school year runs **September to June**, so July and August are not due.
- **The health record is for every student, not only préscolaire.** The existing `healthNotes` field keeps its meaning (allergies and notes). New fields are added next to it.
- **Authorized pickup (`authorizedPickup`) shows for préscolaire levels.** It is the existing crèche field.
- **The sibling discount is optional and manual.**
  - The form suggests one when another active student has the same guardian phone.
  - The office chooses the percentage (0, 10, 15 or 20 %), and it applies to the monthly fee only.

## Data (Prisma, MongoDB — additive only)

```prisma
enum InscriptionType { SOUTIEN FORMATION SCOLARITE }   // + SCOLARITE

model Settings {
  // …existing
  schoolCycles String[]   // PRESCOLAIRE | PRIMAIRE | COLLEGE | LYCEE; empty = classic mode
  schoolYear   String?    // "2026/2027"; default computed (Sept–Aug)
}

model TuitionFee {
  id             String @id @default(auto()) @map("_id") @db.ObjectId
  branchId       String @db.ObjectId
  branch         Branch @relation(fields: [branchId], references: [id])
  level          String // catalog code, e.g. "P3"
  inscriptionFee Float  @default(0)
  monthlyFee     Float  @default(0)
  insuranceFee   Float  @default(0)
  updatedAt      DateTime @updatedAt
  @@unique([branchId, level])
  @@map("tuition_fees")
}

model Student {
  // …existing (name, surname, birthDate, birthPlace, address, schoolLevel, currentSchool,
  //   fatherName, motherName, parentName, parentPhone, parentRelation, massarNumber,
  //   healthNotes, authorizedPickup, photo…)
  nameAr          String?
  surnameAr       String?
  gender          String?   // M | F
  nationality     String?   // default "Marocaine"
  schoolYear      String?   // "2026/2027" of the current inscription
  enrollmentKind  String?   // NEW | RETURNING (nouvel élève / réinscription)
  fatherCin       String?
  fatherPhone     String?
  fatherJob       String?
  motherCin       String?
  motherPhone     String?
  motherJob       String?
  payer           String?   // FATHER | MOTHER | GUARDIAN — who pays
  emergencyName   String?
  emergencyPhone  String?
  bloodGroup      String?   // A+ … O-
  chronicDiseases String?
  medications     String?
  careConsent     Boolean?  // authorizes first aid / emergency care
  documents       String[]  // checklist codes handed in
  monthlyFee      Float?    // frozen at inscription (after discount)
  siblingDiscount Float?    // % applied to the monthly fee
}
```

- `schoolLevel` holds a catalog code (`"P3"`) for new-mode students. Old students keep their free text, and `levelLabel()` (frontend `lib/levels.ts`) learns the codes.
- The document checklist codes are `BIRTH_CERT` (extrait d'acte de naissance), `PHOTOS`, `LEAVING_CERT` (certificat de départ), `LAST_REPORT` (dernier bulletin), `PARENT_CIN` and `VACCINATION` (carnet de vaccination, préscolaire).
- The deploy runs `prisma db push` on start, which creates the new collection and fields. Nothing is backfilled.

## Backend

- `src/modules/school-mode/levels.ts` holds the catalog: cycles, codes, FR/AR labels, `levelsOfCycles()` and `isLevelCode()`. The frontend has the same file at `lib/schoolLevels.ts`, with a "keep in sync" comment like `packs.ts`.
- **Settings:**
  - `PUT /settings` accepts `schoolCycles` and `schoolYear`.
  - `schoolCycles` is validated: known cycles only, and only for `PRIVATE_SCHOOL`.
- **Tuition fees** (ADMIN/OWNER, tenant-scoped; the module includes a service and its tests):
  - `GET /tuition-fees` returns the grid for the branch's levels.
  - `PUT /tuition-fees` takes `{ items: [{ level, inscriptionFee, monthlyFee, insuranceFee }] }` and upserts them. Unknown levels and negative amounts answer 400.
- **Inscription:** `POST /students/school-inscription` (ADMIN/OWNER/SECRETARY) runs in one transaction:
  1. It validates the payload: names required, a level from the branch's cycles, a known gender, `MASSAR` as one letter + 9 digits (only checked when given), and phones normalized like the import.
  2. It reads `TuitionFee` for the level. The office may override the amounts, and the overrides win.
  3. It creates the `Student` with the new fields. It also links or creates the `Parent` by guardian phone, the same way the Excel import does.
  4. It creates an `Inscription` with `type: SCOLARITE`, `category: level`, `amount = inscriptionFee + insuranceFee + first month`, and the note « Inscription {schoolYear} ».
  5. It records the amount paid now in up to two `Payment`s, so the monthly dues stay exact:
     - The fees part, `min(paid, inscriptionFee + insuranceFee)`, has no `forMonth`.
     - The rest, capped at the first month's fee, has `forMonth` = the start month: the current month, or September when registering during the summer.
     - Anything above that is refused with 400. Advance months are collected from « Mensualités ».
  6. With transport chosen, it creates the `TransportSubscription` through the existing transport service, with the route, the stop and the start date.
  7. It returns the student with a summary of the amounts.
- **Monthly dues:**
  - `GET /tuition/dues?month=YYYY-MM` lists the active new-mode students. For each one it gives `monthlyFee`, the amount paid for that month, and the status `PAID`/`PARTIAL`/`UNPAID`. July and August answer an empty list.
  - `POST /tuition/payments` takes `{ studentId, forMonth, amount, method }`. It creates a `Payment` with `forMonth` and refuses a month that is already fully paid. It also feeds the transactions income, the same way existing payments do.
- **Pack options stay as they are.** The new mode is not a pack option. Transport inside the form follows the `TRANSPORT` option (hidden and refused without it).

## Frontend

- **Settings → "Cycles de l'établissement"** (PRIVATE_SCHOOL only):
  - Four checkboxes and the school year.
  - A hint explains that checking a cycle switches the inscription to the professional form.
- **Finance → Prix:** in the new mode, a table « Frais de scolarité par niveau » with one row per level of the chosen cycles and editable inscription / monthly / insurance amounts. The subject price table stays only for tutoring schools.
- **Inscriptions:** in the new mode, a new `SchoolInscriptionForm` in steps. The steps can be reopened and are validated on submit. The fees panel stays visible on the side, as in the current form.
  1. **Élève:**
     - nom/prénom (FR) and الاسم/النسب (AR), sexe, date and lieu de naissance, nationalité;
     - code Massar, adresse, photo.
  2. **Scolarité:**
     - année scolaire;
     - niveau, from the catalog filtered by cycles, shown in FR/AR;
     - groupe/classe, from the groups of that level, optional;
     - nouvel élève / réinscription, école précédente.
  3. **Parents:**
     - père (nom, CIN, téléphone, profession), mère (same fields);
     - tuteur légal if different, with the lien de parenté;
     - qui paie, contact d'urgence.
  4. **Santé:**
     - groupe sanguin, allergies, maladies chroniques, médicaments, autorisation de soins;
     - for préscolaire, the « personnes autorisées » list (the existing UI).
  5. **Services et frais:**
     - transport (ligne / arrêt, monthly price shown), sibling discount;
     - the amounts pre-filled from the grid and editable, the amount paid now, the payment method;
     - the documents checklist.
  - **After saving**, three buttons: « Imprimer le dossier » (bilingual print view, FR or AR following the interface), « Imprimer le reçu » (the existing thermal receipt), and « Nouvelle inscription ».
- **Student file:**
  - The Informations tab shows the new fields in sections. The tab is editable with the same sections, through `PUT /students/:id`, which accepts the new fields.
  - A Santé block is shown to staff only.
- **Finance → « Mensualités »** (new page, ADMIN/OWNER/SECRETARY):
  - month selector, defaulting to the current month;
  - totals (expected / collected / remaining);
  - the list of students with their status, an « Encaisser » action (amount pre-filled, method) and a WhatsApp reminder link to the guardian (wa.me, like the parent access page);
  - a filter by level or group.
- **Dashboard:** « Impayés » in the new mode is the sum of unpaid tuition months up to the current month, plus unpaid inscriptions.
- **Excel import:**
  - The level column also accepts the catalog codes and the FR/AR labels: « 3AP », « السنة الثالثة ابتدائي » and « 2ème année préscolaire » all map to the right code.
  - New optional columns: nom arabe, prénom arabe, sexe, code Massar (already there).
- **Texts:** every new string is in FR (`tr()` source) with an AR entry, the same as the rest of the app.

## Out of scope (phase 1)

- The online pre-inscription (phase 2) and the préscolaire daily log (phase 3).
- A cantine or any other paid service besides transport and insurance.
- Automatic reminders. The office sends the WhatsApp reminder link by hand.
- Report cards per level for préscolaire: the existing grades stay optional.
- Moving existing students to catalog codes. They keep their text level until they are edited.

## Errors and edge cases

- **No fee for the chosen level:** the form shows « Aucun tarif pour ce niveau : renseignez-le dans Prix » and allows manual amounts.
- **Massar already used by another active student in the branch:** 400 « Code Massar déjà utilisé par {name} ».
- **The guardian phone matches an existing parent:** the student is linked to that parent, as in the import, and the sibling discount is suggested.
- **Paying a month that is already paid:** 400. **Partial payments** add up within the same month.
- **A student marked inactive** leaves the dues list from the following month.

## Testing

- **Backend unit tests (jest, mocked prisma, existing style):**
  - the catalog helpers;
  - the settings validation;
  - the tuition grid validation and upsert;
  - the inscription transaction: amounts, discount, parent linking, transport branch, Massar duplicate;
  - the dues computation: paid / partial / unpaid, July and August empty, inactive students;
  - the payment refusal when a month is already paid.
- **Route tests:** roles (secretary allowed for inscription and dues, refused for the grid) and the tenant scope.
- **Browser check (Playwright, demo school Al Wafa):**
  - set the cycles préscolaire + primaire and fill the grid;
  - register a PS2 child and a P3 child, with a sibling;
  - print the file in FR and AR;
  - collect a month and see the dues list update;
  - check that a tutoring center still shows the old form.
