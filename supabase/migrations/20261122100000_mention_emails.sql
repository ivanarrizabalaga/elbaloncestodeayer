-- Email notifications for mentions in memories (SPEC §12): a daily digest.
--
-- A trigger on memories records who was mentioned (memory_mentions). Once a day the digest
-- (src/lib/mention-digest.ts, run by Vercel Cron with the secret key) sends each person one
-- email with their pending mentions, logs it in mention_emails and marks them notified.
-- Admins can pause it (mention_settings) and see the counts; users can opt out.

-- Per-account opt-out, from /cuenta.
alter table public.profiles
  add column mention_emails boolean not null default true;
grant update (mention_emails) on public.profiles to authenticated;

-- Who was mentioned where. Only accounts (people someone has claimed), never the author.
-- notified_at stays set once sent, so editing the memory does not notify again.
create table public.memory_mentions (
  memory_id uuid not null references public.memories (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  primary key (memory_id, profile_id)
);
create index memory_mentions_pending_idx on public.memory_mentions (created_at)
  where notified_at is null;

-- One row per digest email sent: the monthly and daily counters in /admin/avisos.
create table public.mention_emails (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  mentions int not null check (mentions > 0),
  sent_at timestamptz not null default now()
);
create index mention_emails_sent_at_idx on public.mention_emails (sent_at);

-- The admin switch. A single row.
create table public.mention_settings (
  id boolean primary key default true check (id),
  paused boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
insert into public.mention_settings default values;

alter table public.memory_mentions enable row level security;
alter table public.mention_emails enable row level security;
alter table public.mention_settings enable row level security;

-- Admins see everything (counts in /admin/avisos) and flip the switch. Nobody else reads
-- these tables: rows are written by the trigger below and by the digest (secret key).
create policy "memory_mentions: admin read" on public.memory_mentions
  for select to authenticated using (public.is_admin());
create policy "mention_emails: admin read" on public.mention_emails
  for select to authenticated using (public.is_admin());
create policy "mention_settings: admin read" on public.mention_settings
  for select to authenticated using (public.is_admin());
create policy "mention_settings: admin update" on public.mention_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.memory_mentions, public.mention_emails from anon, authenticated;
grant select on public.memory_mentions, public.mention_emails to authenticated;
revoke all on public.mention_settings from anon, authenticated;
grant select, update (paused, updated_at, updated_by) on public.mention_settings to authenticated;

-- Keeps memory_mentions in step with a memory's body: mentions are «@[Name](person id)»
-- (src/lib/mentions.ts). A mention taken out before the digest is dropped; one already
-- notified is kept, so it is not sent again.
create function public.sync_memory_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profiles uuid[];
begin
  select coalesce(array_agg(distinct p.claimed_by), '{}')
    into v_profiles
    from regexp_matches(
      new.body,
      '@\[[^]\n]{1,200}\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)',
      'g'
    ) as m
    join public.people p on p.id = m[1]::uuid
    where p.claimed_by is not null
      and p.claimed_by is distinct from new.author_id;

  if tg_op = 'UPDATE' then
    delete from public.memory_mentions
      where memory_id = new.id
        and notified_at is null
        and profile_id <> all (v_profiles);
  end if;

  insert into public.memory_mentions (memory_id, profile_id)
    select new.id, unnest(v_profiles)
    on conflict do nothing;
  return null;
end;
$$;

revoke execute on function public.sync_memory_mentions() from public, anon, authenticated;

create trigger memories_sync_mentions
  after insert or update of body on public.memories
  for each row execute function public.sync_memory_mentions();
