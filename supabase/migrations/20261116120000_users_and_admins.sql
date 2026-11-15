-- Phase 5.5: users and admins (/admin/usuarios).
--
-- Admins list accounts (emails live in auth.users, so a function exposes them to admins
-- only), make or remove admins, block and unblock. The «at least one admin» rule is the
-- trigger from the initial schema. accept_invitation is replaced to record «invited by» and
-- to check the email an invitation was sent to.

-- ---------------------------------------------------------------------------
-- admin_user_list: every account with what the admin needs to decide.
-- ---------------------------------------------------------------------------

create function public.admin_user_list()
returns table (
  id uuid,
  email text,
  display_name text,
  role public.user_role,
  blocked_at timestamptz,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  invited_by_name text,
  person_name text,
  person_slug text,
  tags_count bigint,
  memories_count bigint,
  suggestions_count bigint,
  photos_count bigint,
  open_reviews_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;

  return query
  select
    p.id,
    u.email::text,
    p.display_name,
    p.role,
    p.blocked_at,
    p.created_at,
    u.last_sign_in_at,
    inviter.display_name,
    person.full_name,
    person.slug,
    (select count(*) from public.tags t where t.created_by = p.id),
    (select count(*) from public.memories m where m.author_id = p.id),
    (select count(*) from public.review_items r
      where r.created_by = p.id and r.kind = 'name_suggestion'),
    (select count(*) from public.photos ph where ph.proposed_by = p.id),
    (select count(*) from public.review_items r
      where r.assigned_to = p.id and r.status = 'open')
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.profiles inviter on inviter.id = p.invited_by
  left join public.people person on person.claimed_by = p.id
  order by p.created_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_user_role / set_user_blocked: admins only, recorded in activity.
-- An admin cannot block themselves; the last active admin is protected by the trigger.
-- ---------------------------------------------------------------------------

create function public.set_user_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;

  update public.profiles set role = p_role where id = p_user_id and role <> p_role;
  if found then
    insert into public.activity (actor_id, action, target_type, target_id, data)
    values (auth.uid(), 'role_changed', 'profile', p_user_id, jsonb_build_object('role', p_role));
  end if;
end;
$$;

create function public.set_user_blocked(p_user_id uuid, p_blocked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() or p_user_id = auth.uid() then
    raise exception 'not_allowed';
  end if;

  update public.profiles
    set blocked_at = case when p_blocked then now() end
    where id = p_user_id and (blocked_at is not null) <> p_blocked;
  if found then
    insert into public.activity (actor_id, action, target_type, target_id)
    values (auth.uid(), case when p_blocked then 'user_blocked' else 'user_unblocked' end,
            'profile', p_user_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- accept_invitation (replaces phase 5.1): same as before, plus the email check and
-- profiles.invited_by.
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

revoke execute on function public.admin_user_list() from public, anon, authenticated;
revoke execute on function public.set_user_role(uuid, public.user_role) from public, anon, authenticated;
revoke execute on function public.set_user_blocked(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_user_list() to authenticated;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;
grant execute on function public.set_user_blocked(uuid, boolean) to authenticated;
