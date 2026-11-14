-- Initial schema for El baloncesto de ayer (SPEC.md §4) with row level security (SPEC.md §2).
--
-- Scope of this migration:
--   * All tables, enums, indexes and the "at least one admin" rule.
--   * Row-level policies for the simple cases: public reads, admin full access,
--     and plain user inserts (propose photo, tag, memory, invitation, review item).
--   * Flows that need several steps or column-level rules (claim profile, remove own tag,
--     accept invitation, make/remove admin, block user, activity logging) are added as
--     SECURITY DEFINER functions in the phases that build them (SPEC.md §9, phase 5).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('user', 'admin');
create type public.photo_status as enum ('proposed', 'draft', 'published', 'rejected', 'withdrawn');
create type public.review_kind as enum (
  'photo_proposal',
  'name_suggestion',
  'removal_request',
  'tag_dispute',
  'duplicate_person'
);
create type public.review_status as enum ('open', 'resolved', 'dismissed');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per user with an account. Created automatically on sign-up (see handle_new_user).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role public.user_role not null default 'user',
  invited_by uuid references public.profiles (id) on delete set null,
  blocked_at timestamptz,
  created_at timestamptz not null default now()
);

-- People who appear in photos, with or without an account.
-- claimed_by is the single link between an account and its person (one person per account).
create table public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) > 0),
  slug text not null unique,
  bio text,
  claimed_by uuid unique references public.profiles (id) on delete set null,
  merged_into uuid references public.people (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (merged_into is distinct from id)
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  status public.photo_status not null default 'draft',
  season_label text,
  year_from int check (year_from between 1900 and 2100),
  year_to int check (year_to between 1900 and 2100),
  team text,
  venue text,
  competition text,
  provenance text,
  photographer text,
  story text,
  instagram_url text,
  featured boolean not null default false,
  storage_key text,
  width int check (width > 0),
  height int check (height > 0),
  proposed_by uuid references public.profiles (id) on delete set null,
  published_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check (year_to is null or year_from is null or year_to >= year_from)
);

-- One face in one photo. person_id null = unidentified «?» face. Soft-deleted via removed_at.
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  person_id uuid references public.people (id) on delete set null,
  x real not null check (x between 0 and 1),
  y real not null check (y between 0 and 1),
  label_number int not null check (label_number > 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  removed_by uuid references public.profiles (id) on delete set null,
  removed_at timestamptz
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(trim(body)) between 1 and 4000),
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  role public.user_role not null default 'user',
  person_id uuid references public.people (id) on delete cascade,
  tag_id uuid references public.tags (id) on delete set null,
  email text,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null
);

-- The admin "Pending" queue. Withdrawal requests are always priority.
create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  kind public.review_kind not null,
  status public.review_status not null default 'open',
  priority boolean not null default false,
  photo_id uuid references public.photos (id) on delete cascade,
  tag_id uuid references public.tags (id) on delete cascade,
  person_id uuid references public.people (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind <> 'removal_request' or priority)
);

-- Log for "Recent activity" and undo. Written only by SECURITY DEFINER functions/triggers.
create table public.activity (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes (foreign keys and common filters)
-- ---------------------------------------------------------------------------

create index photos_status_published_at_idx on public.photos (status, published_at desc);
create index tags_photo_id_idx on public.tags (photo_id);
create index tags_person_id_idx on public.tags (person_id);
create unique index tags_photo_label_active_idx on public.tags (photo_id, label_number)
  where removed_at is null;
create index memories_photo_id_idx on public.memories (photo_id);
create index invitations_person_id_idx on public.invitations (person_id);
create index review_items_open_idx on public.review_items (priority desc, created_at)
  where status = 'open';
create index activity_created_at_idx on public.activity (created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions used by policies
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER so policies on profiles can call them without recursing into RLS.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and blocked_at is null
  );
$$;

-- Signed in and not blocked.
create function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and blocked_at is null
  );
$$;

create function public.is_published_photo(p_photo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.photos where id = p_photo_id and status = 'published'
  );
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Create a profile for every new auth user. display_name stays empty on purpose:
-- we never derive it from the email, which must not become public.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- There must always be at least one active admin (SPEC.md §2).
create function public.ensure_an_admin_remains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.blocked_at is null
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.blocked_at is not null)
     and not exists (
       select 1 from public.profiles
       where id <> old.id and role = 'admin' and blocked_at is null
     )
  then
    raise exception 'There must always be at least one admin';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger profiles_ensure_an_admin_remains
  before update of role, blocked_at or delete on public.profiles
  for each row execute function public.ensure_an_admin_remains();

-- Withdrawal requests are always priority, whoever files them.
create function public.set_review_priority()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.priority := new.priority or new.kind = 'removal_request';
  return new;
end;
$$;

create trigger review_items_set_priority
  before insert or update of kind, priority on public.review_items
  for each row execute function public.set_review_priority();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.people enable row level security;
alter table public.photos enable row level security;
alter table public.tags enable row level security;
alter table public.memories enable row level security;
alter table public.invitations enable row level security;
alter table public.review_items enable row level security;
alter table public.activity enable row level security;

-- profiles: you see your own row; admins see everyone.
-- Users may only change their display_name (column privilege below). Role and blocking
-- changes go through admin functions added in phase 5.
create policy "profiles: read own or as admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Public names only (e.g. memory authors). Deliberately runs with the owner's rights to expose
-- just these two columns without opening up the rest of profiles.
create view public.profile_names
with (security_invoker = false) as
  select id, display_name from public.profiles;

grant select on public.profile_names to anon, authenticated;

-- people: public to read; admins manage.
create policy "people: public read" on public.people
  for select to anon, authenticated
  using (true);

create policy "people: admin insert" on public.people
  for insert to authenticated
  with check (public.is_admin());

create policy "people: admin update" on public.people
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "people: admin delete" on public.people
  for delete to authenticated
  using (public.is_admin());

-- photos: published ones are public; proposers see their own proposals; admins see all.
create policy "photos: read published, own proposals or as admin" on public.photos
  for select to anon, authenticated
  using (
    status = 'published'
    or public.is_admin()
    or proposed_by = (select auth.uid())
  );

create policy "photos: user proposes, admin creates" on public.photos
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      public.is_active_user()
      and status = 'proposed'
      and proposed_by = (select auth.uid())
      and published_by is null
      and published_at is null
      and featured = false
    )
  );

create policy "photos: admin update" on public.photos
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "photos: admin delete" on public.photos
  for delete to authenticated
  using (public.is_admin());

-- tags: active tags on published photos are public; users tag on published photos.
create policy "tags: read active on published photos or as admin" on public.tags
  for select to anon, authenticated
  using (
    public.is_admin()
    or (removed_at is null and public.is_published_photo(photo_id))
  );

create policy "tags: users tag published photos" on public.tags
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      public.is_active_user()
      and created_by = (select auth.uid())
      and removed_at is null
      and removed_by is null
      and public.is_published_photo(photo_id)
    )
  );

create policy "tags: admin update" on public.tags
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "tags: admin delete" on public.tags
  for delete to authenticated
  using (public.is_admin());

-- memories: visible ones on published photos are public; authors see their own.
create policy "memories: read visible, own or as admin" on public.memories
  for select to anon, authenticated
  using (
    public.is_admin()
    or author_id = (select auth.uid())
    or (hidden_at is null and public.is_published_photo(photo_id))
  );

create policy "memories: users write on published photos" on public.memories
  for insert to authenticated
  with check (
    public.is_active_user()
    and author_id = (select auth.uid())
    and hidden_at is null
    and public.is_published_photo(photo_id)
  );

create policy "memories: admin update" on public.memories
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "memories: admin delete" on public.memories
  for delete to authenticated
  using (public.is_admin());

-- invitations: users invite as 'user'; only admins invite admins.
-- Looking up an invitation by token (anonymous) and accepting it are functions in phase 5.
create policy "invitations: read own or as admin" on public.invitations
  for select to authenticated
  using (public.is_admin() or invited_by = (select auth.uid()));

create policy "invitations: users invite users, admins invite anyone" on public.invitations
  for insert to authenticated
  with check (
    public.is_active_user()
    and invited_by = (select auth.uid())
    and accepted_at is null
    and accepted_by is null
    and (role = 'user' or public.is_admin())
  );

create policy "invitations: admin update" on public.invitations
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "invitations: admin delete" on public.invitations
  for delete to authenticated
  using (public.is_admin());

-- review_items: visitors can only file withdrawal requests; users file the user-facing kinds.
create policy "review_items: read own or as admin" on public.review_items
  for select to authenticated
  using (public.is_admin() or created_by = (select auth.uid()));

create policy "review_items: visitors request withdrawal" on public.review_items
  for insert to anon
  with check (
    kind = 'removal_request'
    and status = 'open'
    and created_by is null
    and assigned_to is null
    and resolved_by is null
    and resolved_at is null
  );

create policy "review_items: users file requests" on public.review_items
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      public.is_active_user()
      and created_by = (select auth.uid())
      and kind <> 'duplicate_person'
      and status = 'open'
      and assigned_to is null
      and resolved_by is null
      and resolved_at is null
    )
  );

create policy "review_items: admin update" on public.review_items
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "review_items: admin delete" on public.review_items
  for delete to authenticated
  using (public.is_admin());

-- activity: admins read; nobody writes directly (only SECURITY DEFINER functions/triggers).
create policy "activity: admin read" on public.activity
  for select to authenticated
  using (public.is_admin());
