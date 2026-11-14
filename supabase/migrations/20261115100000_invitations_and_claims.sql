-- Phase 5.1: invitations and claiming a person profile (SPEC §5 "Invitation").
--
-- Invitations are created through RLS (users invite users, admins anyone). The link carries a
-- random token; only its SHA-256 (hex) is stored in invitations.token_hash.
-- The steps that cross table boundaries are SECURITY DEFINER functions that check permissions
-- themselves:
--   * invitation_preview: what the invitation page shows, also to visitors without an account.
--   * accept_invitation:  links the signed-in account to the invited person («Sí, soy yo»).
--   * claim_person:       «Este soy yo» from a person page, without an invitation.
--   * dispute_invitation: «No soy yo» → a tag_dispute in the review queue.

create function public.invitation_token_hash(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- invitation_preview: no rows for an unknown token.
-- ---------------------------------------------------------------------------

create function public.invitation_preview(p_token text)
returns table (
  status text,            -- 'valid' | 'expired' | 'accepted'
  role public.user_role,
  person_id uuid,
  person_name text,
  person_slug text,
  person_claimed boolean,
  inviter_name text,
  photo_slug text,
  photo_team text,
  photo_season text,
  photo_storage_key text,
  photo_width int,
  photo_height int,
  tag_x real,
  tag_y real
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when i.accepted_at is not null then 'accepted'
      when i.expires_at <= now() then 'expired'
      else 'valid'
    end,
    i.role,
    p.id,
    p.full_name,
    p.slug,
    p.claimed_by is not null,
    inviter.display_name,
    ph.slug,
    ph.team,
    ph.season_label,
    ph.storage_key,
    ph.width,
    ph.height,
    t.x,
    t.y
  from public.invitations i
  left join public.people p on p.id = i.person_id
  left join public.profiles inviter on inviter.id = i.invited_by
  -- Only show the photo if it is public and the tag still stands.
  left join public.tags t on t.id = i.tag_id and t.removed_at is null
  left join public.photos ph on ph.id = t.photo_id and ph.status = 'published'
  where i.token_hash = public.invitation_token_hash(p_token);
$$;

-- ---------------------------------------------------------------------------
-- accept_invitation: returns the slug of the person now linked (null for an admin
-- invitation without a person).
-- ---------------------------------------------------------------------------

create function public.accept_invitation(p_token text)
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
-- claim_person: «Este soy yo» on a person page. Shows up in Recent activity so an admin
-- can undo it.
-- ---------------------------------------------------------------------------

create function public.claim_person(p_person_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_person public.people;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'not_allowed';
  end if;

  select * into v_person from public.people where id = p_person_id for update;
  if not found or v_person.merged_into is not null then
    raise exception 'person_not_found';
  elsif v_person.claimed_by = v_uid then
    return v_person.slug;
  elsif v_person.claimed_by is not null then
    raise exception 'person_already_claimed';
  elsif exists (select 1 from public.people where claimed_by = v_uid) then
    raise exception 'account_already_linked';
  end if;

  update public.people set claimed_by = v_uid where id = v_person.id;
  update public.profiles
    set display_name = coalesce(display_name, v_person.full_name)
    where id = v_uid;

  insert into public.activity (actor_id, action, target_type, target_id)
  values (v_uid, 'person_claimed', 'person', v_person.id);

  return v_person.slug;
end;
$$;

-- ---------------------------------------------------------------------------
-- dispute_invitation: «No soy yo». Open to visitors (they arrive from a WhatsApp link),
-- one open dispute per invitation.
-- ---------------------------------------------------------------------------

create function public.dispute_invitation(p_token text, p_suggested_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.invitations;
  v_name text := nullif(left(trim(coalesce(p_suggested_name, '')), 200), '');
begin
  select * into v_invitation
  from public.invitations
  where token_hash = public.invitation_token_hash(p_token);

  if not found or v_invitation.accepted_at is not null or v_invitation.expires_at <= now() then
    raise exception 'invitation_not_found';
  end if;

  if exists (
    select 1 from public.review_items
    where kind = 'tag_dispute'
      and status = 'open'
      and payload ->> 'invitation_id' = v_invitation.id::text
  ) then
    return;
  end if;

  insert into public.review_items (kind, tag_id, person_id, created_by, payload)
  values (
    'tag_dispute',
    v_invitation.tag_id,
    v_invitation.person_id,
    auth.uid(),
    jsonb_build_object('invitation_id', v_invitation.id, 'suggested_name', v_name)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: Supabase grants EXECUTE on new functions to PUBLIC, anon and authenticated by
-- default; revoke and grant only what each function needs.
-- ---------------------------------------------------------------------------

revoke execute on function public.invitation_preview(text) from public, anon, authenticated;
revoke execute on function public.accept_invitation(text) from public, anon, authenticated;
revoke execute on function public.claim_person(uuid) from public, anon, authenticated;
revoke execute on function public.dispute_invitation(text, text) from public, anon, authenticated;

grant execute on function public.invitation_preview(text) to anon, authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.claim_person(uuid) to authenticated;
grant execute on function public.dispute_invitation(text, text) to anon, authenticated;
