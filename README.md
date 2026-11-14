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
pnpm dev          # http://localhost:3000
pnpm check        # lint + typecheck + format check + build
```

Database:

```bash
pnpm db:reset     # re-create the local DB from supabase/migrations + supabase/seed.sql
pnpm db:test      # pgTAP tests (supabase/tests), mainly RLS
pnpm db:lint      # lint SQL functions
pnpm db:types     # regenerate src/lib/supabase/database.types.ts after a schema change
pnpm db:stop
```

Environment variables are added in the next phase-1 PR.

## Licence

The **code** is released under the [MIT](LICENSE) licence.

The **photographs and people's data** are not part of this repository and are not covered by that licence: they belong to their authors or to whoever contributes them. If you appear in a photo and want it withdrawn, you can request it from the website itself.
