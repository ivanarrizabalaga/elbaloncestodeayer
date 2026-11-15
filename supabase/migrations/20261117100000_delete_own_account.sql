-- Phase 6: «Borrar mi cuenta» (SPEC §12, right to be forgotten).
--
-- What goes and what stays:
--   * the account and its profile: deleted (auth.users → profiles cascades);
--   * their memories: deleted;
--   * their person in the archive: released (claimed_by → null by the foreign key);
--   * tags they added: kept, without author (they describe the photo, not the user);
--   * photos they proposed that are not published: deleted. Published ones stay, without
--     contributor; the page tells them to withdraw them first if they want them gone;
--   * review items and activity: kept, without author (foreign keys set null).
-- Returns the ids of the deleted photos so the app removes their files from storage.
-- The last active admin cannot delete their account (trigger on profiles).

create function public.delete_own_account()
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_allowed';
  end if;

  delete from public.memories where author_id = v_uid;

  return query
    delete from public.photos
    where proposed_by = v_uid and status <> 'published'
    returning id;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_own_account() from public, anon, authenticated;
grant execute on function public.delete_own_account() to authenticated;
