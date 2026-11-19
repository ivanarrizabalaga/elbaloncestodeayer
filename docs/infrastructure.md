# Infrastructure

How production is set up. Most of it is configured once by hand in each provider's dashboard; what can live in the repo does (`supabase/config.toml`, `vercel.json`, `scripts/`).

No secrets in this file or anywhere in the repo. They live in the providers, in `.env.prod` (gitignored) and in the maintainer's password manager.

## Overview

| Piece | Provider | Where |
|---|---|---|
| Domain `elbaloncestodeayer.com` | Namecheap (registrar) | Nameservers point to Cloudflare |
| DNS | Cloudflare | All records "DNS only" (grey cloud) |
| Web app | Vercel (Hobby) | Project `elbaloncestodeayer`, functions in `dub1` (Dublin) |
| Database + Auth | Supabase (Free) | Project `elbaloncestodeayer`, ref `nardwkpviokncuyuinmq`, `eu-west-1` (Ireland) |
| Email (magic links) | Resend (Free) | Domain `mail.elbaloncestodeayer.com`, `eu-west-1` |
| Images | Cloudflare R2 | 4 buckets in the EU jurisdiction (production and dev × public and originals) |
| Database backups | GitHub Actions → Cloudflare R2 | Weekly, bucket `elbaloncestodeayer-backups` (see «Backups») |

## DNS (Cloudflare)

| Name | Type | Points to | Purpose |
|---|---|---|---|
| `@` | CNAME (flattened) | Vercel (`*.vercel-dns-017.com`) | Website |
| `www` | CNAME | Vercel | Redirects to the apex (set in Vercel) |
| `resend._domainkey.mail` | TXT | DKIM key | Resend signature |
| `send.mail`, `rsend.mail` | CNAME | Resend | Resend sending (SPF / bounces) |
| `img` | R2 custom domain (proxied, orange cloud) | Public derivatives bucket | Images, TLS 1.2 minimum |
| `@` | MX ×3 + TXT (SPF) + `cf2024-1._domainkey` TXT | Cloudflare Email Routing | Incoming mail: `hola@` is forwarded to the archive's Gmail |

Vercel records must stay **DNS only**: with the orange proxy Vercel cannot issue certificates.

## Vercel

- Git integration with the GitHub repo: `main` deploys to production, every PR gets a preview (protected by Vercel Authentication).
- `elbaloncestodeayer.com` is the production domain; `www` redirects to it (308).
- Environment variables (Project Settings → Environment Variables):

  | Variable | Environments |
  |---|---|
  | `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview |
  | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production, Preview |
  | `CRON_SECRET` | Production (Sensitive) |
  | `SUPABASE_SECRET_KEY` | Production (Sensitive). Only used to create invited accounts |
  | `NEXT_PUBLIC_IMAGES_URL` | Production, Preview |
  | `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BUCKET`, `R2_ORIGINALS_BUCKET` | Production |

  `NEXT_PUBLIC_*` values are inlined at build time: redeploy after changing them. The Supabase secret key is only used by `src/lib/supabase/admin.ts`, to create the account of someone accepting an invitation (sign-ups are disabled).
- `vercel.json`: functions region `dub1` and a daily cron (06:00 UTC) calling `/api/keep-alive`, which runs a light query so Supabase Free does not pause the project after a week of inactivity. Vercel sends `Authorization: Bearer $CRON_SECRET`.
- Web Analytics enabled in the project (Analytics tab). The `<Analytics />` component in the root layout sends page views; it only reports on deployments, not in local dev.
- Previews use the production database (there is only one Supabase project). Signing in does not work on previews: magic links always point to the production domain.

## Supabase

Created with "Enable Data API" and "Automatically expose new tables" on (the migrations rely on the default grants; RLS protects every table) and "automatic RLS" off (migrations enable it).

Linked from the repo with `pnpm exec supabase login` and `pnpm exec supabase link --project-ref nardwkpviokncuyuinmq` (stored in `supabase/.temp`, gitignored).

- **Schema:** `pnpm prod:db-push` applies pending migrations from `supabase/migrations/`. Never edit the database by hand in the dashboard.
- **Auth configuration:** `supabase/config.toml` holds both the local config and, under `[remotes.production]`, what differs in production: site URL, redirect URLs, SMTP and rate limits. The Spanish email templates are shared.
  - `pnpm prod:config-diff` shows what would change.
  - `pnpm prod:config-push` applies it (asks for confirmation).
- Sign-ups are disabled (`enable_signup = false`): accounts are created server side (invitations, `prod:admin grant`).

## Resend

- Domain `mail.elbaloncestodeayer.com` (a subdomain, so the apex keeps its own mail setup and reputation), verified with the DNS records above.
- One API key with "Sending access" restricted to that domain. Supabase uses it as the SMTP password (`smtp.resend.com:465`, user `resend`, sender `no-reply@mail.elbaloncestodeayer.com`).
- Free plan: 3,000 emails/month, 100/day. Supabase limits magic links to 30/hour (`[remotes.production.auth.rate_limit]`).

## Cloudflare R2 (images)

Four buckets, all created with the **EU jurisdiction** (it cannot be changed later; their S3 endpoint is `https://<account-id>.eu.r2.cloudflarestorage.com`):

| Bucket | Access | Use |
|---|---|---|
| `elbaloncestodeayer-public` | Public through `img.elbaloncestodeayer.com` (r2.dev URL disabled) | Production derivatives |
| `elbaloncestodeayer-originals` | Private | Production originals |
| `elbaloncestodeayer-dev-public` | Public through its r2.dev URL | Local development |
| `elbaloncestodeayer-dev-originals` | Private | Local development |

- Layout: `photos/<id>/original` (originals bucket), `photos/<id>/thumb.webp` (~480 px) and `photos/<id>/large.webp` (~1600 px) in the public bucket. `photos.storage_key` is `photos/<id>`.
- Uploads: the browser PUTs the original with a presigned URL (10 minutes), then a Server Action makes the derivatives with `sharp` and creates the draft.
- CORS on both originals buckets: `PUT` with `content-type` from `https://elbaloncestodeayer.com` and `http://localhost:3000`.
- One Account API token, "Object Read & Write" on the four buckets. Its keys are server-only (`R2_*`).

## Backups

Supabase Free has no downloadable backups, so a GitHub Action (`.github/workflows/backup.yml`) dumps the production database every Sunday at 03:00 UTC with `scripts/backup.sh` and uploads `db-YYYY-MM-DD.tar.gz` (`roles.sql`, `schema.sql`, `data.sql`) to a private R2 bucket. Sessions and one-time tokens are left out on purpose. Photos are not part of it: the originals live in R2.

The repo is public, so the dump never goes into the repo, the logs or the run's artifacts. Locally, `pnpm db:backup` dumps the local database into `backups/` (gitignored).

### Setup (once)

1. **R2 bucket:** create `elbaloncestodeayer-backups` with the **EU jurisdiction**, private. In its settings, add an object lifecycle rule: delete objects after 90 days.
2. **R2 token:** a new Account API token, «Object Read & Write», applied **only** to the backups bucket. Keep the Access Key ID and Secret Access Key.
3. **Database URL:** in Supabase, *Connect* → *Session pooler* (IPv4: GitHub runners have no IPv6). Copy the URI and put the database password in it.
4. **GitHub secrets:** in the repo, *Settings → Secrets and variables → Actions → New repository secret*:

| Secret | Value |
|---|---|
| `SUPABASE_DB_URL` | The session pooler URI, with the password |
| `R2_BACKUP_ACCESS_KEY_ID` | From step 2 |
| `R2_BACKUP_SECRET_ACCESS_KEY` | From step 2 |
| `R2_ENDPOINT` | `https://<account-id>.eu.r2.cloudflarestorage.com` (same as the app's) |

5. **GitHub variable:** same page, *Variables* tab → *New repository variable*: `R2_BACKUPS_BUCKET` = `elbaloncestodeayer-backups` (not a secret, so it shows in the logs).
6. **First run:** *Actions → Backup → Run workflow*, then check that the file appears in the bucket.

GitHub pauses scheduled workflows after 60 days without activity in the repo and sends an email; re-enable it from the Actions tab.

### Restore

Into a **new, empty** Supabase project (Supabase's own restore procedure):

```sh
mkdir restore && tar -xzf db-YYYY-MM-DD.tar.gz -C restore
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file restore/roles.sql \
  --file restore/schema.sql \
  --command 'SET session_replication_role = replica' \
  --file restore/data.sql \
  --dbname "<new project's session pooler URI>"
```

Then point the app at the new project: its URL and keys in Vercel and `.env.prod`, `project_id` in `supabase/config.toml` (`[remotes.production]`), and `pnpm prod:config-push` for the auth settings. Everyone keeps their account; they just sign in again.

The data part was rehearsed locally: empty the tables, load `data.sql` with `session_replication_role = replica`, same counts as before.

## `.env.prod` and the `prod:*` scripts

Production scripts read a local, gitignored `.env.prod` with the variables listed in `.env.example`: Supabase URL and keys, `SUPABASE_DB_PASSWORD` (optional, asked for otherwise) and `RESEND_API_KEY`.

```bash
pnpm prod:db-push              # apply new migrations
pnpm prod:config-diff          # preview Auth config changes
pnpm prod:config-push          # apply them
pnpm prod:admin list           # list admins
pnpm prod:admin grant <email>  # make someone admin (creates the account if needed)
pnpm prod:import-instagram <dir> [--dry-run]  # Instagram export as drafts (see below)
pnpm prod:import-folder <dir> --map <map.json> [--dry-run]  # folder of photos as drafts (see below)
pnpm prod:backfill-hashes [--dry-run]  # image_hash for photos that have none (see below)
```

## Instagram import (phase 4)

1. Request the export from the account: Instagram → Accounts Center → Your information and permissions → Download your information → Some of your information → **Posts** → Download to device, **Format: JSON**, **Media quality: High**, **Date range: All time**. It can take hours.
2. Unzip it into `instagram-export/` at the repo root (gitignored; never commit it).
3. Try it locally first: `pnpm import:instagram instagram-export --dry-run`, then without `--dry-run` (dev buckets, local database).
4. Production: `.env.prod` also needs the `R2_*` variables with the production buckets. Then `pnpm prod:import-instagram instagram-export --dry-run`, and again without `--dry-run` (asks for confirmation). Use `--provenance "…"` to fill the provenance of every draft, and `--limit N` to go in batches.
5. Review and publish each draft at `/admin/subir`.

## Folder import

For a folder of photos (e.g. a Google Drive download). Keep the folder and its map **outside the repo**.

1. Write the map (JSON). Every key is optional; values merge as map < folder < file:

   ```json
   {
     "provenance": "…",
     "skip": ["VIDEOS", "VARIOS/logo.png"],
     "folders": { "CAU": { "team": "CAU Oviedo" } },
     "files": {
       "CAU/Foto_1.jpg": { "season": "Años 70", "venue": "…" },
       "MIERES/IMG_1.HEIC": { "rotate": 270 }
     }
   }
   ```

   Fields: `team`, `venue`, `competition`, `season` («1984–85», «1979» or «Años 70»), `provenance`, `story`, `rotate` (90, 180 or 270, clockwise). Folder names are matched without trailing spaces.
2. Locally: `pnpm import:folder <dir> --map <map.json> --dry-run` shows counts per folder, identical copies and map entries that match nothing. Then without `--dry-run` (dev buckets, local database). Needs macOS (`sips`) for HEIC files.
3. Production: run `pnpm prod:db-push` first if the `source_file`/`image_hash` migration is not applied yet. Then `pnpm prod:import-folder … --dry-run`, a first batch with `--limit 10`, and the rest. It asks for confirmation and lists drafts that look like a photo already in the archive.
4. Review and publish each draft at `/admin/subir`. Photos from one folder can be found with `source_file like 'PAPA/%'`.

## Image hashes for older photos

`image_hash` (used to flag photos that look the same) is filled by the importers. Photos from before it, such as the Instagram import, get theirs with:

1. `pnpm backfill:hashes --dry-run` locally, then without `--dry-run`.
2. Production: `pnpm prod:backfill-hashes --dry-run`, then without it (asks for confirmation). It reads each original from R2, so `.env.prod` needs the `R2_*` variables.

It only touches photos without a hash, so it can be run again at any time (e.g. to retry failures). At the end it lists the pairs that look like the same picture.

## Releasing a change

1. Merge the PR into `main`. Vercel deploys it.
2. If it has new migrations: `pnpm prod:db-push`. Run it right after merging; migrations should be backwards compatible with the previous deploy.
3. If it changes `supabase/config.toml`: `pnpm prod:config-diff`, then `pnpm prod:config-push`.
