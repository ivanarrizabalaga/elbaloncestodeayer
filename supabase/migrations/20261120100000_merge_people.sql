-- Merge duplicate people (SPEC §5 "Duplicates"), from /admin/personas/[id].
--
-- merge_people(source, target): everything that pointed at the duplicate (source) moves to the
-- person that stays (target), and the source keeps merged_into so its old links redirect.
-- One SECURITY DEFINER function so the moves happen together, with the admin check inside.

create function public.merge_people(p_source uuid, p_target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.people;
  v_target public.people;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  if p_source = p_target then
    raise exception 'same_person';
  end if;

  select * into v_source from public.people where id = p_source for update;
  select * into v_target from public.people where id = p_target for update;
  if v_source.id is null or v_target.id is null
     or v_source.merged_into is not null or v_target.merged_into is not null then
    raise exception 'person_not_found';
  end if;

  -- An account is linked to one person: two linked accounts cannot become one person.
  if v_source.claimed_by is not null and v_target.claimed_by is not null then
    raise exception 'both_claimed';
  end if;

  update public.people
    set claimed_by = null, merged_into = v_target.id
    where id = v_source.id;
  update public.people
    set claimed_by = coalesce(v_target.claimed_by, v_source.claimed_by),
        bio = coalesce(v_target.bio, v_source.bio)
    where id = v_target.id;
  -- Earlier duplicates of the source now point straight at the target.
  update public.people set merged_into = v_target.id where merged_into = v_source.id;

  update public.tags set person_id = v_target.id where person_id = v_source.id;
  update public.invitations set person_id = v_target.id where person_id = v_source.id;
  update public.review_items set person_id = v_target.id where person_id = v_source.id;

  insert into public.activity (actor_id, action, target_type, target_id, data)
  values (
    auth.uid(), 'people_merged', 'person', v_target.id,
    jsonb_build_object('merged_id', v_source.id, 'merged_name', v_source.full_name)
  );

  return v_target.slug;
end;
$$;

revoke execute on function public.merge_people(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_people(uuid, uuid) to authenticated;
