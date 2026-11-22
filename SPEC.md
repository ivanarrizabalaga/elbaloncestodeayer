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
| Request an account («Pide acceso») | ✓ (form) | | |
| Request a photo withdrawal | ✓ (form) | ✓ | ✓ |
| Withdraw a photo they proposed (immediate) | | ✓ | ✓ |
| Propose photos | | ✓ (goes to review) | — |
| Upload, edit, publish and withdraw photos | | | ✓ |
| Work the review queue | | | ✓ |
| Undo tags / hide memories | | | ✓ |
| Create, edit and merge people | | | ✓ |
| Make admin, remove admin, invite admins | | | ✓ |
| Approve or reject account requests | | | ✓ |
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
| Home / gallery | `/` | `Main.dc.html` | Photo of the week, filters (decade, team, venue, "only unnamed faces"), masonry gallery, «Ayuda a ponerles nombre» block. Each filter only offers values that still give photos with the other filters applied, with a count («CB Ribera (12)»). Active filters show as removable chips with the number of photos, plus «Quitar filtros». Competition is also a filter (`?competicion=`) but has no control in the bar: it is reached from a photo page and removed from its chip |
| Photo page | `/foto/[slug]` | `Foto.dc.html`, `FotoMovil.dc.html` | Photo with numbered markers on faces, «En la foto» list (own profile / Invite / «Sé quién es»), details, story, memories, «Más de esta temporada», privacy links. Team, decade, venue and competition in the details link to the gallery filtered by that value. Full-size view over the page (back closes it). Under the photo, «Anterior» / «Siguiente» through the gallery list it was opened from: gallery links carry the filters in the URL (`?decada=…`), swiping the photo works card style (it follows the finger and the neighbour shows underneath; off while tagging, when a tap on the photo picks a face), and ← → on a keyboard, and it stops at both ends; stepping replaces the history entry, so going back skips the photos stepped through. «Volver» (instead of breadcrumbs: the archive is a flat, filtered list) goes back to the previous page of the site (gallery, person, admin…), like the browser's back button; arriving from outside, it goes to the gallery with those filters. Admin pages' «← Volver» works the same way, and same-page redirects after saving use `replace` so «Volver» never lands on the same page |
| Person page | `/persona/[slug]` | `Persona.dc.html` | Volver, name, featured face crop, «Sale con», photos by season, share, invite; *Editar persona* for admins |
| Choose featured photo | `/persona/[slug]/foto-destacada` | _(no mockup)_ | The person themselves or an admin picks which tag's face crop leads the page (and the WhatsApp preview). Default: the photo of their most recent season. `people.portrait_tag_id` + `set_person_portrait` |
| Invitation | `/invitacion/[token]` | `Invitacion.dc.html` | Arrives via link (WhatsApp): «¿Eres tú?» → email → magic link → signed in. Also «No soy yo» |
| Request access | `/registro` | _(no mockup)_ | Name, email and «Tengo 14 años o más»; linked from `/entrar`. Same answer whether or not the email already has an account |
| Propose photos | `/proponer` | _(no mockup)_ | Users upload photos for review; «Tus fotos»: one list, pending first, each row with a title (team and season, else the uploaded file's name), a status pill and its action (*Añadir datos*, *Retirar*, *Ver foto*, *Quitar de la lista*). Optional «Datos comunes a estas fotos» when uploading |
| Details of your photo | `/proponer/[id]` | _(no mockup)_ | The proposer fills in season, team (and second team), venue, competition, provenance, photographer and story while the photo is pending |
| Withdrawal request | `/foto/[slug]/retirar` | _(no mockup)_ | Reason and optional contact; the contributor withdraws directly instead |
| My account | `/cuenta` | _(no mockup)_ | Change the display name, link to your person and photos, sign out, delete the account |
| Privacy | `/privacidad` | _(no mockup)_ | What is stored, where, and how to change or delete it (§11) |

### Admin
| Screen | Route | Mockup | What it does |
|---|---|---|---|
| Pending review | `/admin/pendiente` | `AdminPendiente.dc.html` | Queue: proposed photos, suggested names, withdrawal requests (priority), «No soy yo» disputes, possible duplicates. «Me lo quedo» to split the work. Recent activity with undo |
| Upload and tag | `/admin/subir` | `AdminSubir.dc.html` | Multi-upload into drafts, click a face → search existing person / create new / leave as «?». Photo details. Publish. Drafts as a grid or a table (50 per page, filter by imported folder, lookalikes flagged by `image_hash`) with bulk «Publicar» / «Descartar» |
| Accesos (users and admins) | `/admin/usuarios` | `AdminUsuarios.dc.html` | Who can sign in and what they can do. List of admins (with pending invitations), users and access requests. Invite admin, make/remove admin, block, approve/reject requests |
| People | `/admin/personas` | _(no mockup)_ | Every person with their status (no invitation, pending, expired, has an account), searchable; invite or new link. The name opens the public person page; *Editar* opens `/admin/personas/[id]`: edit name and bio, manage their account (or invite them), merge a duplicate |
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
- `team_2`: optional second team, for photos showing two (a game, a tournament, both squads). Neutral, not «rival»: we don't know which side the photo was taken from. Both count the same: the title reads «CB Ribera – Estudiantes», the photo page lists «Equipos» with a link each, the gallery's team filter matches either and both share the autocomplete list. A lone second team is saved as the first. Person summaries (teams a person played for) use only `team`.
- `provenance`, `photographer`, `story`, `instagram_url`, `featured` (the «foto de la semana» on the home page; only one at a time: featuring a photo unfeatures the previous one. With none featured, the home shows the latest published photo)
- `storage_key`, `width`, `height`
- `source_file`: for imported photos, the file's path in the imported folder or export; for proposed photos, the uploaded file's name (no `/`, so it never counts as a folder)
- `image_hash`: a perceptual hash to spot duplicates across imports, proposals, screenshots and resized copies
- `proposed_by`, `published_by`, `published_at`, `created_at`

**tags** — one face in one photo
- `photo_id`, `person_id` (nullable = unidentified «?» face), `x`, `y` (0–1, relative to the image), `label_number`
- `created_by`, `created_at`, `removed_by`, `removed_at` (soft delete so it can be undone)

**memories** — memories / anecdotes
- `photo_id`, `author_id`, `body`, `hidden_at`, `created_at`

**invitations**
- `token_hash`, `role` (`user` | `admin`), `person_id` (nullable), `tag_id` (nullable: the tag the invite was sent from), `email` (nullable), `invited_by`, `created_at`, `expires_at` (7 days), `accepted_at`, `accepted_by`

**access_requests** — «Pide acceso» from `/registro`
- `name`, `email`, `age_confirmed_at`, `status` (`pending` | `approved` | `rejected`), `invitation_id` (set on approval), `resolved_by`, `resolved_at`, `created_at`
- One pending request per email. Only admins read them; they are written only through `SECURITY DEFINER` functions.

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

**Invite an admin** — from `/admin/usuarios`: the admin types an email; an invitation with `role = admin` is bound to that email and a magic link is sent to it (the account is created if needed), and the link is also shown to copy. Accepting promotes the account; only the account with that email can accept it. Pending admin invitations can be resent (new link, 7 more days) or cancelled. The optional message in the mockup was left out: the email is Supabase's sign-in email.

**Request access** — for people nobody has invited yet. `/registro` (linked from `/entrar`) asks for a name, an email and «Tengo 14 años o más»; a hidden honeypot field drops bots. The answer is always «Solicitud enviada», also when the email already has an account or a pending request (nothing is stored then). Admins see the requests in a «Solicitudes» tab of `/admin/usuarios`, counted in the admin menu. *Aprobar* creates a user invitation bound to the email and sends it like an admin invitation (account created, magic link to `/invitacion/[token]`); accepting it sets the display name to the requested name and «Invitado por» to the approving admin. Approved requests not yet accepted can be resent. *Rechazar* asks for confirmation and does not notify; they can ask again. No email to admins on new requests: they see them in the menu. Both decisions are recorded in activity.

**Accesos (users and admins)** — `/admin/usuarios`, «Accesos» in the admin menu, is about permissions: it lists admins (with pending invitations) and users (with their person, linking to its page in `/admin/personas/[id]`, who invited them and their contributions; searchable). It is the only place for accounts not linked to a person. Make admin, remove admin, block and unblock ask for confirmation, go through `SECURITY DEFINER` functions and are recorded in activity. An admin cannot block themselves, and the last active admin cannot be removed (database trigger). «Invitado por» is the inviter of the first invitation an account accepted.

**Remove own tag** — immediate (`removed_at`), recorded in `activity`.

**Photo withdrawal** — priority `review_item`; the admin moves it to `withdrawn` (no longer visible; the original is not deleted until confirmed).

**Withdrawing your own photo** — the photos belong to whoever contributes them (§11), so the account that proposed a photo (`proposed_by`) can always take it down, without review:
- Still `proposed` (nothing else depends on it): it is deleted.
- `published`: it moves to `withdrawn` immediately and is recorded in `activity`. Tags and memories are kept but hidden, so the work of others is not lost. Admins cannot republish it unless the contributor asks. The original follows the usual rule (deleted only once confirmed).
- Photos uploaded by admins on someone else's behalf (e.g. the Instagram import) have no `proposed_by`; they follow the normal withdrawal request.
- Implemented as a `SECURITY DEFINER` function (`withdraw_own_photo`) in phase 5.

**Proposing photos** — `/proponer`, for signed-in users who are not blocked. They upload one or more photos with an optional comment and confirm they may share them. Each photo is created as `proposed` with a `photo_proposal` item in the queue, and the user sees it under «Tus fotos». Whoever uploads a photo usually knows it best, so they can give its details (season, team, venue, competition, provenance, photographer, story): optionally for the whole batch when uploading («Datos comunes a estas fotos»), and per photo afterwards in `/proponer/[id]` (*Añadir datos*), only while it is `proposed`, through `update_own_proposal`. Instagram and «foto de la semana» stay admin-only. The free comment remains for anything else. The queue card shows those details (the story behind «Leer la historia») with three actions: *Publicar* as it is, straight from the queue; *Revisar* to open `/admin/fotos/[id]` with the form already filled in, to correct details or tag faces before publishing; and *Rechazar*. An admin who reviews it checks and completes the details, tags it and publishes it, which resolves the item; or rejects it, which deletes the files and keeps the row as `rejected` so the user sees the outcome: «No publicada», named by its file (there is no thumbnail any more), with a line pointing to the contact email and *Quitar de la lista*, which deletes the row. No rejection reason for now. Limit: 30 photos per user per day.

**Withdrawal request** — `/foto/[slug]/retirar`, linked from every photo page. The form asks for a reason (required) and, optionally, a name (visitors only) and an email or phone to reply to, which only admins see. The contributor of the photo sees «Retirar esta foto» there instead and takes it down at once. Admins can also withdraw a published photo from its editor, which resolves open withdrawal requests for it, and publish it again later with the same address. A photo its contributor took down cannot be republished from the admin pages.

**Suggested name** — `review_item`; on acceptance an existing person is assigned (matched by name, ignoring accents and case) or a new one is created. Identical suggestions for the same face are shown as one item, and accepting one dismisses the other open suggestions for that face.

**«No soy yo» in the queue** — *Mantener* closes it. *Quitar el nombre* turns the face back into «?», expires the invitation and, if a name was proposed, files it as a name suggestion credited to whoever proposed it.

**Recent activity** — lists what was published without review. Undo: a user's tag is removed (soft delete), a memory is hidden, a claim («Este soy yo» or an accepted invitation) is released.

**People** — `/admin/personas` lists every person of the archive (not merged), most photographed first, 50 per page: name (opens their public page), number of photos, «Cuenta» and actions. «Cuenta» is one line of plain text, no pills or links: *Tiene cuenta*, *Invitada · caduca …* (the latest open invitation), *La invitación caducó* or *Sin invitar*. Everything you can do is a button in the actions column: *Invitar* / *Nuevo enlace* for people without an account, and always *Editar*. Next to the name search, pills filter by *Sin invitar* (which includes expired invitations), *Invitación pendiente* and *Con cuenta*, with counts that follow the search. *Invitar* / *Nuevo enlace* creates a user invitation like «Invitar» on a photo (from one of their published tags, so the invitation page shows the photo) and offers the link for WhatsApp or to copy: person invitations are not bound to an email, so there is nothing to email. Older links stay valid until they expire. *Editar* opens `/admin/personas/[id]`, which has a «Cuenta» section: for a person with an account, its role, email and last sign-in, with the same make/remove admin and block/unblock actions as Accesos (they return to the person); without one, *Invitar* / *Nuevo enlace*. An account is managed from its person; Accesos still lists every account. Reads go through the existing RLS (admins read all invitations and profiles).

**Wording** — the UI uses two words: *persona* (someone in the photos; their public page is «su página en la web», links say «Ver en la web») and *cuenta* (someone who can sign in, user or admin). Not «perfil» or «ficha». In admin tables the name links to what everyone sees on the site; admin actions are buttons.

**Duplicates** — from `/admin/personas/[id]` the admin picks the person that stays and confirms. `merge_people` (`SECURITY DEFINER`) moves tags, invitations and review items to the target, and the account link and bio if the target had none; the duplicate gets `merged_into` (earlier duplicates of it are repointed), so its page redirects. Two people linked to different accounts cannot be merged. Recorded in activity; no undo. Editing a person changes name and bio only: the slug stays so shared links keep working.

---

## 6. Images

- Stored in **Cloudflare R2**, in two buckets: a **public** one for derivatives and a **private** one for originals. (R2 public access is per bucket, not per prefix.)
- On upload the server generates (with `sharp`) two derivatives: **thumbnail** (~480 px) and **large** (~1600 px), as WebP.
- It also computes the photo's `image_hash`. If it looks like a photo already in the archive, the uploader says so under the file: admins see every lookalike, linking to its admin page; a user proposing a photo only sees published ones (and their own proposals, unlinked), never drafts. It is only a notice: the upload goes ahead.
- Derivatives are served publicly from the public bucket through a custom domain; the **original** is kept in the private bucket.
- Direct browser upload to R2 with a presigned URL; processing happens afterwards on the server.
- No paid on-the-fly transformations.
- **Link previews** (WhatsApp, etc.): `/foto/[slug]/vista-previa` converts the large derivative into a 1200×630 JPEG (WhatsApp handles JPEG more reliably than WebP), cached by the CDN. Photo, person and home pages use it as their Open Graph image (a person page uses their latest photo; the home page, the featured one).

---

## 7. Instagram import

One-off, from Jorge's account export (Instagram → "Download your information", JSON format):
- A local script (`pnpm import:instagram` / `pnpm prod:import-instagram`) that creates one **draft** photo per **image**: a carousel post gives one draft per image, all with the same caption. Videos are skipped.
- The caption (without hashtag-only lines) becomes the `story`; a season or year found in it pre-fills `season_label` and the years. Everything is reviewed by an admin before publishing.
- The export has no link to each post, so `instagram_url` stays empty unless an admin adds it.
- Idempotent: running it again skips images already imported.
- The export **never** goes into the repo (`instagram-export/` is in `.gitignore`).

**Folder import.** Same idea for a folder of photos (e.g. a Google Drive download), with `pnpm import:folder` / `pnpm prod:import-folder`:
- One draft per image (HEIC converted to JPEG); videos are skipped.
- A JSON map kept **outside the repo** (it holds real names) pre-fills `team`, `venue`, `competition`, `season_label`, `provenance` and `story` per folder or per file, can skip files and can turn images scanned sideways. A decade-only season is written «Años 70».
- Each draft keeps `source_file` (so photos that came together, e.g. one folder, can be found later) and `image_hash`; the script lists drafts that look like a photo already there.
- Photos from before `image_hash` (the Instagram import, earlier uploads) get theirs with a one-off local script (`pnpm backfill:hashes` / `pnpm prod:backfill-hashes`), computed from the original in R2.
- Idempotent: the id comes from the file's bytes, so identical copies are imported once.

---

## 8. Infrastructure

- **Next.js** (App Router, TypeScript, Tailwind) on **Vercel** (Hobby).
- **Supabase**: Postgres + Auth (email magic link, with a 6-digit code in the same email for the installed app, see §12) + RLS. Project in the **EU (Ireland, eu-west-1)** region; Vercel functions run in Dublin (`dub1`) next to it.
- **Transactional email** for magic links through a custom SMTP provider, **Resend** (Supabase's built-in email only reaches project members and is heavily rate-limited).
- **Cloudflare R2** for images.
- **Daily cron** (Vercel Cron) running a light query so Supabase Free does not pause the project.
- Versioned SQL migrations in `supabase/migrations/`.
- Backups: a weekly GitHub Action dumps the database (roles, schema, data; without sessions or tokens) to a private R2 bucket kept 90 days. Setup and restore in `docs/infrastructure.md`.

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
- Privacy page stating who runs the archive (the controller's name comes from the `PRIVACY_CONTROLLER_NAME` environment variable, so it is not in the public repo) and how to request changes. Contact: `hola@elbaloncestodeayer.com`, forwarded to the archive's Gmail with Cloudflare Email Routing.
- Accounts are for people aged 14 or over (LOPDGDD art. 7), stated on the privacy page. Invited people are vouched for by whoever invites them; people who ask for access (`/registro`) must tick «Tengo 14 años o más», stored as `access_requests.age_confirmed_at`. No date of birth is asked for (data minimisation).
- **Minors:** the archive is of old photos. Photos showing people who are minors **today** are not published without their parents' permission, and those people are never tagged by name. The proposal checkbox includes it; admins apply it when reviewing; a withdrawal request for a minor is always granted.
- **Copy of your data (GDPR art. 15 / 20):** requested by email and answered within a month. No button: see §12.
- No tracking cookies or invasive analytics. Visits are counted with Vercel Web Analytics (cookieless, no IP stored, aggregate only), stated on the privacy page.
- The repo's MIT licence covers **only the code**; the photos belong to their authors or to whoever contributes them.

---

## 12. Open questions / future work

Decisions deliberately postponed. Revisit them in the phase noted.

- **Users creating people while tagging** (decided in phase 5.2, revisit if needed). Only admins create people; users tag existing people (published at once) or, for someone not in the archive, leave a «?» face with a name suggestion that goes to review. Revisit if the review queue becomes a bottleneck; the risk is duplicate people ("Pepe García" vs "Pepe Garcia").
- **Account deletion / right to be forgotten** (decided in phase 6). «Borrar mi cuenta» in `/cuenta` (`delete_own_account`): the account and profile are deleted, their memories are deleted, their person is released, tags they added stay without author, their unpublished photos are deleted with their files, and published photos stay without contributor (the page tells them to withdraw them first if they want them gone). The last active admin cannot delete their account. Documented on the privacy page.
- **Spam on anonymous withdrawal requests** (phase 6, only if it happens). Start with nothing; if spam appears, add Cloudflare Turnstile (free, no tracking) to the form.
- **Mentions in memories** (after phase 6, in two steps). **Done:** typing `@` and a few letters in a memory (new or edited) lists people from the archive under the textarea; picking one inserts «@Name». It is stored in the body as `@[Name](person id)`, so no extra table: pages show the person's current name linked to their page, a deleted person shows as plain text, and snippets (review queue) show just the name. **Emails (done):** a **daily digest**. A trigger on `memories` records the mentioned accounts in `memory_mentions` (never the author; people without an account are not emailed; an edit does not notify again). Every morning (Vercel Cron, `/api/mention-digest`) each person with pending mentions gets one email («Juan y Ana te han mencionado en 3 recuerdos»), with each memory, its photo and a link. Resend's free tier (3,000/month, 100/day) is shared with the sign-in emails, which must never run out, so the digest sends at most 50 a day and 1,500 a month (calendar month, UTC); over that, or paused, mentions wait and go out when there is room. Mentions on hidden memories or unpublished photos wait too. `/admin/avisos` has the pause switch and the counts (this month, today, pending, last sent); it counts only these emails, the sign-in emails are in Resend's dashboard. Opt-out per account in `/cuenta` (opted out or blocked: those mentions are dropped, not sent later). The digest runs without a signed-in user, so it uses the secret key (the second and last use of it in the app).
- **Data export** (only if requests come). Today a copy of someone's data is requested by email and prepared by hand. If it becomes frequent, a `pnpm prod:export-user <email>` script that zips a JSON (account, contributions, photos they are tagged in) and the originals of their photos; a button in `/cuenta` only if it gets really common.
- **Signing in from the installed app on iPhone** (decided after phase 6). The site is installable (web app manifest, `display: standalone`, no service worker; on iPhone, launch screens with the ball and the name, one per screen size, built at build time — Android draws its own from the manifest, icon only). On iOS the home-screen app keeps its cookies apart from Safari, and the magic link in the email opens in Safari, so the session would land there and not in the app. The sign-in email therefore carries both the link and a 6-digit code (Supabase's email OTP, same expiry). After asking for it, `/entrar` and the invitation's «Mira tu correo» step offer «Entrar con el código»; the email it was sent to is kept in a short-lived httpOnly cookie, so only the code is typed.
