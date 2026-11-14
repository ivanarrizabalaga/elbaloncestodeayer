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

_Filled in during phase 1._

## Licence

The **code** is released under the [MIT](LICENSE) licence.

The **photographs and people's data** are not part of this repository and are not covered by that licence: they belong to their authors or to whoever contributes them. If you appear in a photo and want it withdrawn, you can request it from the website itself.
