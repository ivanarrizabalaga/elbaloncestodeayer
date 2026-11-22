-- Featured photo of a person (the face crop at the top of /persona/[slug]).
--
-- people.portrait_tag_id: one of their own tags. Null means the default, the photo of their
-- most recent season. A tag that is removed or no longer on a published photo is ignored by
-- the page, which falls back to the default.
-- set_person_portrait: the person themselves (the account linked to them) or an admin.
-- A SECURITY DEFINER function because users cannot update people rows (column-level rule).
--
-- No foreign key on purpose: a second link between people and tags would make the existing
-- PostgREST embeds (people → tags, tags → people) ambiguous. The function checks the tag when
-- it is set, and a stale id is harmless because the page falls back to the default.

alter table public.people add column portrait_tag_id uuid;

create function public.set_person_portrait(p_person_id uuid, p_tag_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person public.people;
begin
  select * into v_person from public.people where id = p_person_id;
  if v_person.id is null or v_person.merged_into is not null then
    raise exception 'person_not_found';
  end if;

  if not (
    public.is_admin()
    or (public.is_active_user() and v_person.claimed_by = auth.uid())
  ) then
    raise exception 'not_allowed';
  end if;

  -- Null goes back to the default; otherwise one of their tags on a published photo.
  if p_tag_id is not null and not exists (
    select 1 from public.tags t
    where t.id = p_tag_id
      and t.person_id = p_person_id
      and t.removed_at is null
      and public.is_published_photo(t.photo_id)
  ) then
    raise exception 'tag_not_found';
  end if;

  update public.people set portrait_tag_id = p_tag_id where id = p_person_id;
end;
$$;

revoke execute on function public.set_person_portrait(uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_person_portrait(uuid, uuid) to authenticated;
