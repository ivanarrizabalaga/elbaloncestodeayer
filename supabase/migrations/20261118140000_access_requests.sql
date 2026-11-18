-- Access requests («Pide acceso», /registro).
--
-- Anyone without an invitation can ask for an account with a name and an email, and must
-- confirm they are 14 or over. Admins approve or reject them in /admin/usuarios. Approving
-- creates an invitation bound to that email (role 'user', no person); the app then creates
-- the account and emails a magic link to /invitacion/[token], as with admin invitations.
-- Accepting it sets the account's display name to the name given in the request.

create type public.access_request_status as enum ('pending', 'approved', 'rejected');

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  email text not null check (email = lower(email) and length(email) <= 254),
  -- When they ticked «Tengo 14 años o más» (LOPDGDD art. 7).
  age_confirmed_at timestamptz not null,
  status public.access_request_status not null default 'pending',
  invitation_id uuid references public.invitations (id) on delete set null,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- One pending request per email.
create unique index access_requests_pending_email_idx on public.access_requests (email)
  where status = 'pending';
create index access_requests_invitation_id_idx on public.access_requests (invitation_id);

alter table public.access_requests enable row level security;

-- Admins read them; nobody writes directly (only the functions below).
create policy "access_requests: admin read" on public.access_requests
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- request_access: open to visitors. The answer is the same whether the email already has
-- an account or a pending request, so the form does not reveal who is registered.
-- ---------------------------------------------------------------------------

create function public.request_access(p_name text, p_email text, p_age_confirmed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not coalesce(p_age_confirmed, false) then
    raise exception 'age_not_confirmed';
  elsif length(v_name) not between 1 and 120 then
    raise exception 'invalid_name';
  elsif v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 254 then
    raise exception 'invalid_email';
  end if;

  if exists (select 1 from auth.users where lower(email) = v_email) then
    return;
  end if;

  insert into public.access_requests (name, email, age_confirmed_at)
  values (v_name, v_email, now())
  on conflict (email) where status = 'pending' do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- approve_access_request: creates the invitation (the app generates the token and passes
-- its hash) and returns the email to send it to.
-- ---------------------------------------------------------------------------

create function public.approve_access_request(p_id uuid, p_token_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.access_requests;
  v_invitation_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;

  select * into v_request from public.access_requests where id = p_id for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'request_not_pending';
  end if;

  insert into public.invitations (token_hash, role, email, invited_by)
  values (p_token_hash, 'user', v_request.email, v_uid)
  returning id into v_invitation_id;

  update public.access_requests
    set status = 'approved', invitation_id = v_invitation_id,
        resolved_by = v_uid, resolved_at = now()
    where id = p_id;

  insert into public.activity (actor_id, action, target_type, target_id, data)
  values (v_uid, 'access_request_approved', 'access_request', p_id,
          jsonb_build_object('name', v_request.name));

  return v_request.email;
end;
$$;

create function public.reject_access_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.access_requests;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;

  update public.access_requests
    set status = 'rejected', resolved_by = v_uid, resolved_at = now()
    where id = p_id and status = 'pending'
    returning * into v_request;
  if not found then
    raise exception 'request_not_pending';
  end if;

  insert into public.activity (actor_id, action, target_type, target_id, data)
  values (v_uid, 'access_request_rejected', 'access_request', p_id,
          jsonb_build_object('name', v_request.name));
end;
$$;

-- ---------------------------------------------------------------------------
-- accept_invitation (replaces the users-and-admins version): same as before, plus the name
-- from an approved access request when the account has none.
-- ---------------------------------------------------------------------------

create or replace function public.accept_invitation(p_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invitation public.invitations;
  v_person public.people;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'not_allowed';
  end if;

  select * into v_invitation
  from public.invitations
  where token_hash = public.invitation_token_hash(p_token)
  for update;

  if not found then
    raise exception 'invitation_not_found';
  elsif v_invitation.accepted_at is not null then
    raise exception 'invitation_used';
  elsif v_invitation.expires_at <= now() then
    raise exception 'invitation_expired';
  -- Once bound to an email (or sent to one, for admins), only that account can use it.
  elsif v_invitation.email is not null and v_invitation.email is distinct from (
    select lower(email) from auth.users where id = v_uid
  ) then
    raise exception 'invitation_other_email';
  end if;

  if v_invitation.person_id is not null then
    select * into v_person from public.people where id = v_invitation.person_id for update;

    if v_person.claimed_by is not null and v_person.claimed_by <> v_uid then
      raise exception 'person_already_claimed';
    end if;
    if v_person.claimed_by is null and exists (
      select 1 from public.people where claimed_by = v_uid
    ) then
      raise exception 'account_already_linked';
    end if;

    update public.people set claimed_by = v_uid where id = v_person.id;
    update public.profiles
      set display_name = coalesce(display_name, v_person.full_name)
      where id = v_uid;
  end if;

  -- Approved access request: the name they gave when asking.
  update public.profiles
    set display_name = coalesce(display_name, (
      select name from public.access_requests where invitation_id = v_invitation.id
    ))
    where id = v_uid;

  if v_invitation.role = 'admin' then
    update public.profiles set role = 'admin' where id = v_uid;
  end if;

  -- «Invitado por» in /admin/usuarios: the first invitation an account accepts.
  update public.profiles
    set invited_by = coalesce(invited_by, v_invitation.invited_by)
    where id = v_uid and v_invitation.invited_by is distinct from v_uid;

  update public.invitations
    set accepted_at = now(), accepted_by = v_uid
    where id = v_invitation.id;

  insert into public.activity (actor_id, action, target_type, target_id, data)
  values (
    v_uid, 'invitation_accepted', 'person', v_invitation.person_id,
    jsonb_build_object('invitation_id', v_invitation.id, 'role', v_invitation.role)
  );

  return v_person.slug;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants (Supabase grants EXECUTE to PUBLIC, anon and authenticated by default).
-- ---------------------------------------------------------------------------

revoke execute on function public.request_access(text, text, boolean) from public, anon, authenticated;
revoke execute on function public.approve_access_request(uuid, text) from public, anon, authenticated;
revoke execute on function public.reject_access_request(uuid) from public, anon, authenticated;
grant execute on function public.request_access(text, text, boolean) to anon, authenticated;
grant execute on function public.approve_access_request(uuid, text) to authenticated;
grant execute on function public.reject_access_request(uuid) to authenticated;
