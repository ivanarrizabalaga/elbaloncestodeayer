# El baloncesto de ayer

A collaborative photo archive of basketball from the old days: old photos where people tag themselves and invite their teammates.

It started with Jorge's collection, published on Instagram as **#elbaloncestodeayer**. The website is the archive; Instagram is the shop window.

The site is aimed at a Spanish audience, so its UI is in Spanish. Everything in this repo (code and docs) is in English.

## How it works

1. An admin uploads a photo and tags whoever they recognise.
2. Each tagged person can receive a link (usually via WhatsApp): «¿Eres tú?» ("Is this you?").
3. If they recognise themselves, they sign in with their email (no password) and can tag their teammates, add memories and invite whoever is missing.

## Status

🚧 Under construction. See [`SPEC.md`](SPEC.md) for the specification and phases, and [`design/`](design/) for the mockups.

## Stack

Next.js · TypeScript · Tailwind · Supabase (Postgres, Auth, RLS) · Cloudflare R2 · Vercel

## Local development

Requirements: Node 22 (see `.nvmrc`), pnpm (`corepack enable pnpm`) and Docker (for the local Supabase stack). The Supabase CLI is a dev dependency, no global install needed.

```bash
pnpm install
pnpm db:start     # local Supabase: Postgres, Auth, Studio (http://127.0.0.1:54323), Mailpit (http://127.0.0.1:54324)
pnpm env:local    # writes .env.local with the local Supabase keys
pnpm dev          # http://localhost:3000
pnpm check        # lint + typecheck + format check + build
```

Signing in locally: accounts are created by invitation (phase 5), so create one with `pnpm admin:grant you@example.test`, then request a link at http://localhost:3000/entrar. The email does not leave your machine: open it in Mailpit (http://127.0.0.1:54324).

If the email arrives in English («Your sign-in link») the local Auth server lost the Spanish template: it happens right after starting, and after editing `supabase/templates/` (the file is bind-mounted, and tools that rewrite it break the mount). Run `pnpm db:stop && pnpm db:start` (data is kept) and request a new link.

Admins:

```bash
pnpm admin:list
pnpm admin:grant <email>   # makes <email> an admin, creating the account if needed
```

Both use `.env.local`. For production use `pnpm prod:admin list|grant <email>`, which reads `.env.prod` and asks for confirmation.

Database:

```bash
pnpm db:reset     # re-create the local DB from supabase/migrations + supabase/seed.sql (made-up test data)
pnpm db:test      # pgTAP tests (supabase/tests), mainly RLS
pnpm db:lint      # lint SQL functions
pnpm db:types     # regenerate src/lib/supabase/database.types.ts after a schema change
pnpm db:stop
```

The seed has made-up people, teams and placeholder images (`public/seed/`), e.g. http://localhost:3000/foto/cb-ribera-1984-85-equipo.

Uploading photos locally (`/admin/subir`) needs the R2 dev buckets: add the `R2_*` and `NEXT_PUBLIC_IMAGES_URL` variables from `.env.example` to `.env.local` (`pnpm env:local` keeps them).

Instagram import (phase 4): `pnpm import:instagram <export-dir> [--dry-run]` creates one draft per image of an Instagram JSON export. See `docs/infrastructure.md`.

Environment variables are listed in `.env.example`.

## Production

Hosted on Vercel (https://elbaloncestodeayer.com) with Supabase, Resend for email and DNS on Cloudflare. How it is set up, and the `pnpm prod:*` scripts, are in [`docs/infrastructure.md`](docs/infrastructure.md).

## Licence

The **code** is released under the [MIT](LICENSE) licence.

The **photographs and people's data** are not part of this repository and are not covered by that licence: they belong to their authors or to whoever contributes them. If you appear in a photo and want it withdrawn, you can request it from the website itself.
