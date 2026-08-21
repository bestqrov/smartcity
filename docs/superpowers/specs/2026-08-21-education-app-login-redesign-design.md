# education-app Login Page Redesign

## Goal

Replace the generic centered-card login page at `apps/education-app/src/app/[locale]/login/page.tsx`
with a modern split-screen design, visually inspired by the user's other project
(`bestqrov/app-injahi`, a Moroccan school-management SaaS) — without copying its indigo branding
or its custom pill-shaped inputs, since those don't match this app's existing design tokens.

## Scope

Login page only. No changes to the admin shell/sidebar, other pages, or `@smartcity/ui` components
themselves (they're shared with `tourism-app` and `super-admin-dashboard`).

## Layout

Split screen, `lg:flex-row`, full height:

- **Left panel** (`hidden lg:flex lg:w-1/2`): dark branded panel. Background: `slate-900` base with a
  subtle radial/linear gradient toward the app's own `primary` (emerald) tokens — not app-injahi's
  indigo. Centered content: a glassmorphism circle (`bg-white/5 backdrop-blur-xl border border-white/10
  rounded-[40px]`) containing a `GraduationCap` icon from `lucide-react`; below it, a large bold
  heading "SmartCity **Education**" (second word rendered with a gradient-text span using `primary`
  shades); a short glowing divider line; a one-line descriptive subtitle. No photo asset — this app
  has none, so the panel stays illustrative (gradient + icon + text), per the approved design
  question.
- **Right panel** (`w-full lg:w-1/2`): white background, centered form column, `max-w-sm`. Large bold
  heading ("Espace **Connexion**" or the existing i18n string, second word in `primary-600`). Below
  it, the login form.

## Form

Keep using `@smartcity/ui`'s `Input` and `Button` components unchanged — do not fork or extend them,
since they're shared across three apps. Visual lift comes from the *wrapper* markup around them:
generous padding, a soft card shadow on the form container, tighter vertical rhythm, and a bold
`Button` with a `lucide-react` arrow icon (`ArrowRight`) that translates on hover
(`group-hover:translate-x-1`).

Keep existing behavior as-is: `useAuth().login()`, `ApiError` handling, `t('common.error')` fallback,
redirect to `/${locale}/branches` on success. No changes to `src/lib/auth.tsx` or `src/lib/api.ts`.

Also fix the existing minor inconsistency noted during testing: the "Email" input label is hardcoded
in English (`label="Email"`) while every other string on the page goes through `t()`. Switch it to
`t('auth.email')`, adding that key to `packages/i18n/locales/{en,fr,ar}.json` if it doesn't already
exist.

## New dependency

Add `lucide-react` to `apps/education-app/package.json` only (not a shared package — no other app in
the monorepo currently depends on it, so this doesn't affect `tourism-app` or `super-admin-dashboard`).

## Animation

Simple entrance animations on load (fade/slide), matching app-injahi's feel, implemented with plain
Tailwind utilities already available (`animate-in`, `fade-in`, `slide-in-from-*` — confirm these
utilities work with the Tailwind version pinned in this app; if the `tailwindcss-animate` plugin isn't
present, implement the handful of needed keyframes directly in
`apps/education-app/src/app/[locale]/globals.css` instead of adding a new plugin dependency).

## Out of scope

- Admin shell / sidebar redesign (explicitly deferred — login page only for this pass)
- Any change to `@smartcity/ui` component internals
- Any change to auth logic, i18n keys beyond the one `auth.email` addition, or other pages
