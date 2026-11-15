# CLAUDE.md

Guide for working in this repo. Read [`SPEC.md`](SPEC.md) first: it explains what we are building and why.

## Rule number one

**The simplest thing that works.** The maintainer would rather "err on the side of simple" than have something sophisticated that later cannot be maintained. Before adding a dependency, a layer or an abstraction, ask yourself whether it is really needed; if in doubt, don't add it and mention it in the PR.

## Stack

- Next.js (App Router) + TypeScript (strict) + Tailwind CSS.
- Supabase: Postgres, Auth (magic link) and RLS, using `@supabase/ssr` / `@supabase/supabase-js`. No ORM.
- Cloudflare R2 (S3 API) for images; `sharp` to generate derivatives on the server.
- Deployed on Vercel.
- Node 22 LTS and pnpm.

## Conventions

- **Language:** the UI copy is in Spanish (Spain), and so are public URL segments (`/foto/`, `/persona/`, `/admin/pendiente`). **Everything else in the repo is in English**: code, identifiers, table/column names, docs, commit messages and PR descriptions.
- **Server components by default.** Client components only where there is real interaction (tagging on the photo, forms, tabs).
- **Mutations with Server Actions** or simple route handlers. No global state or data-fetching libraries.
- **Styling with Tailwind** using the colour and typography tokens from `SPEC.md` (§3, Visual identity), defined once in the theme config.
- **Database:** every schema change is a new SQL migration in `supabase/migrations/` (never edit one that is already merged). After a change run `pnpm db:reset`, `pnpm db:types` and `pnpm db:test`. Types are generated, never written by hand.
- **Permissions:** simple row rules live in RLS policies. Multi-step flows or column-level rules (claim profile, remove own tag, accept invitation, role changes) are `SECURITY DEFINER` functions with `set search_path = ''` that check permissions themselves.
- **Tests:** keep them few and focused on what matters most: RLS policies, tested with pgTAP in `supabase/tests/` (`pnpm db:test`). Every new policy or permission function gets a test. No UI tests for now.
- **Accessibility:** real elements (`<button>`, `<a>`, `<label>`), `alt` on images, visible focus, touch targets ≥ 44 px, AA contrast.
- **Mobile first:** most people will arrive from a WhatsApp link.

## Security (non-negotiable)

- **RLS on every table.** The permissions in `SPEC.md` §2 are enforced in Postgres policies, not just in the UI.
- Admin checks happen on the server **and** in RLS.
- The Supabase `service_role` key and the R2 keys exist only on the server (environment variables). Never on the client, never in the repo.
- Keep `.env.example` up to date with variable names (no values).

## Real content: never in the repo

The repo is public. **Do not commit** real photos, real names, the Instagram export or database dumps. Test data (`seed`) uses made-up names and placeholder images. If you see anything like that staged for commit, stop and warn.

## Designs

The mockups are in `design/*.dc.html`. They are the visual and behavioural reference, **not code to copy**: they use the design canvas's own template format (`{{...}}`, `<sc-if>`, `<sc-for>`, inline styles). Read them to extract structure, copy, states and styles, and build them with React components + Tailwind. See `design/README.md`.

## Way of working

- One phase of `SPEC.md` §9 per branch and PR (large phases may be split into several small PRs). Small, reviewable PRs.
- If a decision changes something in `SPEC.md`, update it in the same PR.
- Before calling something done, `pnpm check` must pass (it runs `pnpm lint`, `pnpm typecheck`, `pnpm format:check` and `pnpm build`). Use `pnpm format` to fix formatting. Markdown files are not formatted by Prettier.
- This is Next.js 16: APIs differ from older versions (e.g. middleware is now `proxy`). Cache Components is deliberately **off**: pages that read the session just render per request. Check `AGENTS.md` and the docs bundled in `node_modules/next/dist/docs/` before writing Next.js code.
- **Production:** setup and the `pnpm prod:*` scripts are in `docs/infrastructure.md`. Only run `prod:*` scripts when the maintainer asks.
- **Supabase in code:** use `createClient()` / `getCurrentUser()` from `src/lib/supabase/server.ts` (acts as the user, goes through RLS). The secret key is for local scripts in `scripts/`; in the app it is used only by `src/lib/supabase/admin.ts`, to create the account of someone being invited (a user accepting an invitation, or an admin invitation being sent). Do not use it anywhere else.
- If something in the spec is unclear, ask before inventing.
