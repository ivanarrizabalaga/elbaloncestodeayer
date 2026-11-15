-- Phase 5.2: what users do on a photo page.
--
-- Tagging, suggesting names and writing memories go through RLS (see the initial schema).
-- This migration adds:
--   * remove_own_tag: «Quitar mi etiqueta», for the account linked to the tagged person.
--   * activity for contributions published without review (SPEC §2: «Anything published
--     without review shows up in the admin's Recent activity and can be undone»).

-- ---------------------------------------------------------------------------
-- remove_own_tag: immediate soft delete, recorded in activity.
-- ---------------------------------------------------------------------------

create function public.remove_own_tag(p_tag_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tag public.tags;
begin
  if v_uid is null then
    raise exception 'not_allowed';
  end if;

  select t.* into v_tag
  from public.tags t
  join public.people p on p.id = t.person_id
  where t.id = p_tag_id and t.removed_at is null and p.claimed_by = v_uid
  for update of t;

  if not found then
    raise exception 'not_allowed';
  end if;

  update public.tags
    set removed_at = now(), removed_by = v_uid
    where id = v_tag.id;

  insert into public.activity (actor_id, action, target_type, target_id, data)
  values (
    v_uid, 'own_tag_removed', 'tag', v_tag.id,
    jsonb_build_object('photo_id', v_tag.photo_id, 'person_id', v_tag.person_id)
  );
end;
$$;

revoke execute on function public.remove_own_tag(uuid) from public, anon, authenticated;
grant execute on function public.remove_own_tag(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Activity for contributions by non-admins (admins' own work is not queued for review).
-- Blocked users cannot insert at all (RLS), so they never get here.
-- ---------------------------------------------------------------------------

create function public.log_contribution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or public.is_admin() then
    return new;
  end if;

  if tg_table_name = 'tags' then
    insert into public.activity (actor_id, action, target_type, target_id, data)
    values (
      v_uid, 'tag_added', 'tag', new.id,
      jsonb_build_object('photo_id', new.photo_id, 'person_id', new.person_id)
    );
  elsif tg_table_name = 'memories' then
    insert into public.activity (actor_id, action, target_type, target_id, data)
    values (
      v_uid, 'memory_added', 'memory', new.id,
      jsonb_build_object('photo_id', new.photo_id)
    );
  end if;
  return new;
end;
$$;

create trigger tags_log_contribution
  after insert on public.tags
  for each row execute function public.log_contribution();

create trigger memories_log_contribution
  after insert on public.memories
  for each row execute function public.log_contribution();
