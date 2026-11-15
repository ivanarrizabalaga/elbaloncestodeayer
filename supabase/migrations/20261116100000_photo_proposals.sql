-- Phase 5.4: users propose photos and can always take their own photos down (SPEC §5).
--
-- Proposing goes through RLS (initial schema: users insert photos with status 'proposed'
-- and a photo_proposal review item). This migration adds withdraw_own_photo.

-- ---------------------------------------------------------------------------
-- withdraw_own_photo: the account that proposed a photo takes it down, without review.
-- * not published yet (proposed, draft, rejected): the row is deleted (its review items
--   and tags go with it); returns 'deleted' so the app removes the files from storage.
-- * published: it becomes 'withdrawn'; tags and memories are kept but no longer shown.
--   Open review items for it are closed. Returns 'withdrawn'.
-- Blocked accounts can still do it: the photos are theirs.
-- ---------------------------------------------------------------------------

create function public.withdraw_own_photo(p_photo_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_photo public.photos;
begin
  if v_uid is null then
    raise exception 'not_allowed';
  end if;

  select * into v_photo from public.photos
  where id = p_photo_id and proposed_by = v_uid
  for update;

  if not found then
    raise exception 'not_allowed';
  end if;

  if v_photo.status = 'withdrawn' then
    return 'withdrawn';
  end if;

  if v_photo.status <> 'published' then
    delete from public.photos where id = v_photo.id;
    return 'deleted';
  end if;

  update public.photos set status = 'withdrawn', featured = false where id = v_photo.id;

  update public.review_items
    set status = 'resolved', resolved_by = v_uid, resolved_at = now()
    where photo_id = v_photo.id and status = 'open';

  insert into public.activity (actor_id, action, target_type, target_id)
  values (v_uid, 'own_photo_withdrawn', 'photo', v_photo.id);

  return 'withdrawn';
end;
$$;

revoke execute on function public.withdraw_own_photo(uuid) from public, anon, authenticated;
grant execute on function public.withdraw_own_photo(uuid) to authenticated;
