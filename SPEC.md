# El baloncesto de ayer — Specification

A collaborative photo archive of basketball from the old days. It started with Jorge's collection (published on Instagram as **#elbaloncestodeayer**) and grows with what the people in the photos contribute.

The core idea: **someone tags you in a photo → you get a link → you recognise yourself, you sign in → you tag your teammates and invite them.** That way the archive grows by itself.

This is not about making money, it is about sharing.

> Language: everything in this repo is written in English. The site's UI copy is in Spanish (Spain); UI strings quoted below in «guillemets» are the actual Spanish copy.

---

## 1. Principles

1. **Simple and maintainable over sophisticated.** When in doubt between two options, pick the one that can be understood and maintained on a Sunday afternoon.
2. **~€0 running cost.** Free tiers (Vercel Hobby, Supabase Free, Cloudflare R2 Free) plus the domain.
3. **The website is the archive; Instagram is the shop window.** No real-time sync with Instagram.
4. **The code is open; the content is not.** Photos, real names and exports never go into the repo.
5. **Privacy by default.** Anyone can remove their own tag instantly and request that a photo be withdrawn. Data stays in the EU.
6. **Photos come first.** Dark, quiet UI with no ornaments.

---

## 2. Roles and permissions

Two roles: **user** and **admin**. All admins can do exactly the same things. Visitors without an account can only browse.

| Action | Visitor | User | Admin |
|---|:-:|:-:|:-:|
| View photos, people, photo pages | ✓ | ✓ | ✓ |
| Tag someone in a photo (published immediately) | | ✓ | ✓ |
| Suggest a name for an unknown «?» face | | ✓ (goes to review) | ✓ (direct) |
| Add a memory to a photo (published immediately) | | ✓ | ✓ |
| Edit or delete their own memories | | ✓ | ✓ |
| Invite a tagged person | | ✓ | ✓ |
| Claim their person profile («Este soy yo») | | ✓ | ✓ |
| Remove their own tag (immediate) | | ✓ | ✓ |
| Request a photo withdrawal | ✓ (form) | ✓ | ✓ |
| Propose photos | | ✓ (goes to review) | — |
| Upload, edit, publish and withdraw photos | | | ✓ |
| Work the review queue | | | ✓ |
| Undo tags / hide memories | | | ✓ |
| Create, edit and merge people | | | ✓ |
| Make admin, remove admin, invite admins | | | ✓ |
| Block users | | | ✓ |

Rules:
- There must always be **at least one admin**.
- A blocked user cannot tag or propose, but what they already contributed stays.
- Anything published without review shows up in the admin's **Recent activity** and can be undone.

---

## 3. Screens

The mockups live in [`design/`](design/) (see `design/README.md` for how to read them). They are the visual and behavioural reference.

URLs are in Spanish because the audience sees them (e.g. `/foto/[slug]`, `/persona/[slug]`, `/admin/pendiente`). Code identifiers stay in English.

### Public
| Screen | Route | Mockup | What it does |
|---|---|---|---|
| Home / gallery | `/` | `Main.dc.html` | Photo of the week, filters (decade, team, venue, "only unnamed faces"), masonry gallery, «Ayuda a ponerles nombre» block |
| Photo page | `/foto/[slug]` | `Foto.dc.html`, `FotoMovil.dc.html` | Photo with numbered markers on faces, «En la foto» list (own profile / Invite / «Sé quién es»), details, story, memories, «Más de esta temporada», privacy links |
| Person page | `/persona/[slug]` | `Persona.dc.html` | Name, face crop, «Sale con», photos by season, share, invite |
| Invitation | `/invitacion/[token]` | `Invitacion.dc.html` | Arrives via link (WhatsApp): «¿Eres tú?» → email → magic link → signed in. Also «No soy yo» |

### Admin
| Screen | Route | Mockup | What it does |
|---|---|---|---|
| Pending review | `/admin/pendiente` | `AdminPendiente.dc.html` | Queue: proposed photos, suggested names, withdrawal requests (priority), «No soy yo» disputes, possible duplicates. «Me lo quedo» to split the work. Recent activity with undo |
| Upload and tag | `/admin/subir` | `AdminSubir.dc.html` | Multi-upload into drafts, click a face → search existing person / create new / leave as «?». Photo details. Publish |
| Users and admins | `/admin/usuarios` | `AdminUsuarios.dc.html` | List of admins (with pending invitations) and users. Invite admin, make/remove admin, block |
| People | `/admin/personas` | _(no mockup)_ | List, edit, merge duplicates |
| Photos | `/admin/fotos` | _(no mockup)_ | List with status (draft, published, withdrawn), search, edit |
| Instagram import | — | _(no mockup)_ | One-off: load Jorge's export as drafts (local script, see §7) |

### Visual identity (from the mockups)
- Background `#0E0E0E`, surfaces `#161616`/`#181818`/`#1C1C1C`, borders `#262626`/`#3A3A3A`.
- Text `#F2F2F2`, secondary `#A6A6A6`.
- Single accent: basketball orange `#FF7A1A` (text on orange: `#0E0E0E`).
- Typography: **Barlow Condensed** (headings, 600–700) + **Inter** (body).
- Pill buttons, touch targets ≥ 44 px, AA contrast.

---

## 4. Data model (Postgres / Supabase)

All tables have RLS enabled. The schema lives in `supabase/migrations/`; this section is the summary.

**profiles** — one row per user with an account (`id` = `auth.users.id`), created automatically on sign-up
- `display_name` (empty until the user sets it; never derived from the email), `role` (`user` | `admin`), `invited_by`, `blocked_at`, `created_at`
- Only the owner and admins can read a profile. Public names are exposed through the `profile_names` view (`id`, `display_name`).

**people** — people who appear in photos (with or without an account)
- `full_name`, `slug`, `bio`, `claimed_by` (profile, nullable, unique: the single link between an account and its person), `merged_into` (nullable), `created_by`, `created_at`

**photos**
- `slug`, `status` (`proposed` | `draft` | `published` | `rejected` | `withdrawn`)
- `season_label` (free text, e.g. "1984–85"), `year_from`, `year_to` (for decade filtering)
- `team`, `venue`, `competition` (free text with autocomplete from existing values; normalise later only if needed)
- `provenance`, `photographer`, `story`, `instagram_url`, `featured`
- `storage_key`, `width`, `height`
- `proposed_by`, `published_by`, `published_at`, `created_at`

**tags** — one face in one photo
- `photo_id`, `person_id` (nullable = unidentified «?» face), `x`, `y` (0–1, relative to the image), `label_number`
- `created_by`, `created_at`, `removed_by`, `removed_at` (soft delete so it can be undone)

**memories** — memories / anecdotes
- `photo_id`, `author_id`, `body`, `hidden_at`, `created_at`

**invitations**
- `token_hash`, `role` (`user` | `admin`), `person_id` (nullable), `tag_id` (nullable: the tag the invite was sent from), `email` (nullable), `invited_by`, `created_at`, `expires_at` (7 days), `accepted_at`, `accepted_by`

**review_items** — the "Pending" queue
- `kind` (`photo_proposal` | `name_suggestion` | `removal_request` | `tag_dispute` | `duplicate_person`)
- `status` (`open` | `resolved` | `dismissed`), `priority` (bool; `removal_request` is always priority)
- `photo_id`, `tag_id`, `person_id`, `payload` (jsonb: proposed name, reason, duplicate person…)
- `created_by`, `assigned_to`, `resolved_by`, `resolved_at`, `created_at`

**activity** — log for "Recent activity" and undo
- `actor_id`, `action`, `target_type`, `target_id`, `data` (jsonb), `created_at`

---

## 5. Key flows

**Invitation**
1. Someone tags "Pepe" and taps *Invite* → an `invitation` linked to the person is created → a link to share on WhatsApp (with pre-filled text).
2. Pepe opens the link → sees the photo with his face marked → «¿Eres tú?».
3. *Yes* → email → magic link (Supabase Auth) → agrees to his name appearing → his `profile` is linked to the `person` (`people.claimed_by`) and, if his `display_name` is empty, it is set to the person's `full_name` (he can change it later) → welcome.
4. *Not me* («No soy yo») → creates a `review_item` of kind `tag_dispute` (can propose the correct name).

**Invite an admin** — same flow, with `role = admin`; if the email already has an account, it is promoted on acceptance.

**Remove own tag** — immediate (`removed_at`), recorded in `activity`.

**Photo withdrawal** — priority `review_item`; the admin moves it to `withdrawn` (no longer visible; the original is not deleted until confirmed).

**Suggested name** — `review_item`; on acceptance an existing person is assigned or a new one is created.

**Duplicates** — the admin merges: tags move to the target person and the other one gets `merged_into`.

---

## 6. Images

- Stored in **Cloudflare R2**, in two buckets: a **public** one for derivatives and a **private** one for originals. (R2 public access is per bucket, not per prefix.)
- On upload the server generates (with `sharp`) two derivatives: **thumbnail** (~480 px) and **large** (~1600 px), as WebP.
- Derivatives are served publicly from the public bucket through a custom domain; the **original** is kept in the private bucket.
- Direct browser upload to R2 with a presigned URL; processing happens afterwards on the server.
- No paid on-the-fly transformations.

---

## 7. Instagram import

One-off, from Jorge's account export (Instagram → "Download your information", JSON format):
- A local script that creates one **draft** photo per post, with the caption as `story` and the original link.
- Optional: extract names and years from the caption to pre-fill fields (always reviewed by an admin).
- The export **never** goes into the repo (`instagram-export/` is in `.gitignore`).

---

## 8. Infrastructure

- **Next.js** (App Router, TypeScript, Tailwind) on **Vercel** (Hobby).
- **Supabase**: Postgres + Auth (email magic link) + RLS. Project in the **EU (Frankfurt)** region.
- **Transactional email** for magic links through a custom SMTP provider (Supabase's built-in email only reaches project members and is heavily rate-limited).
- **Cloudflare R2** for images.
- **Daily cron** (Vercel Cron) running a light query so Supabase Free does not pause the project.
- Versioned SQL migrations in `supabase/migrations/`.
- Backups: periodic database export (defined in phase 6).

---

## 9. Phases

1. **Skeleton** — Next.js, schema and RLS, magic-link login, Vercel deploy, anti-pause cron.
2. **Read-only public site** — Home, photo page, person page, with test data (`seed`).
3. **Admin: upload and tag** — upload to R2, derivatives, tagging on the photo, draft → published.
4. **Instagram import** — Jorge loads his real archive.
5. **Community** — invitations, claiming profiles, user tagging, review queue, activity, admin management.
6. **Finishing touches** — privacy and withdrawal, backups, photo of the week, basic SEO, WhatsApp sharing with a good link preview.

Each phase on its own branch with its own PR (larger phases may be split into several PRs).

---

## 10. Out of scope (for now)

- Automatic face recognition (biometric data; not worth it).
- Automatic posting to Instagram.
- Likes, followers, private messages.
- Native apps, multiple languages.

---

## 11. Privacy

- When claiming their profile, a person agrees to their name appearing on photos where they are tagged.
- Removing a tag is immediate; a photo withdrawal request arrives as priority.
- Privacy page stating who runs the archive and how to request changes.
- No tracking cookies or invasive analytics.
- The repo's MIT licence covers **only the code**; the photos belong to their authors or to whoever contributes them.

---

## 12. Open questions / future work

Decisions deliberately postponed. Revisit them in the phase noted.

- **Users creating people while tagging** (phase 5). Today only admins create people; users tag existing people or leave a «?» face and suggest a name, which goes to review. Revisit if the review queue becomes a bottleneck; the risk is duplicate people ("Pepe García" vs "Pepe Garcia").
- **Account deletion / right to be forgotten** (phase 6). Today contributions survive account deletion without an author (`on delete set null`). Proposal to evaluate: delete the user's memories, release their claimed person, keep tags (they describe the photo, not the user). Document the outcome on the privacy page.
- **Spam on anonymous withdrawal requests** (phase 6, only if it happens). Start with nothing; if spam appears, add Cloudflare Turnstile (free, no tracking) to the form.
