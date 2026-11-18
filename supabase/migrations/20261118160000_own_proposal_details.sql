-- Whoever proposes a photo can fill in its details while it waits for review (SPEC §5
-- «Proposing photos»). The values can already be set when proposing (photos insert policy);
-- this function covers editing them afterwards, from «Tus fotos».
--
-- Only the descriptive columns, only the account that proposed it, only while it is still
-- 'proposed'. Once published, the details belong to the archive and only admins change them.

create function public.update_own_proposal(
  p_photo_id uuid,
  p_season_label text,
  p_team text,
  p_venue text,
  p_competition text,
  p_provenance text,
  p_photographer text,
  p_story text,
  -- Parsed from the season label by the app (parseSeason); null when it has no year.
  p_year_from int default null,
  p_year_to int default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_user() then
    raise exception 'not_allowed';
  end if;

  update public.photos
    set season_label = nullif(left(trim(p_season_label), 100), ''),
        year_from = p_year_from,
        year_to = p_year_to,
        team = nullif(left(trim(p_team), 200), ''),
        venue = nullif(left(trim(p_venue), 200), ''),
        competition = nullif(left(trim(p_competition), 200), ''),
        provenance = nullif(left(trim(p_provenance), 200), ''),
        photographer = nullif(left(trim(p_photographer), 200), ''),
        story = nullif(left(trim(p_story), 4000), '')
    where id = p_photo_id
      and proposed_by = auth.uid()
      and status = 'proposed';

  if not found then
    raise exception 'not_allowed';
  end if;
end;
$$;

revoke execute on function public.update_own_proposal(uuid, text, text, text, text, text, text, text, int, int)
  from public, anon, authenticated;
grant execute on function public.update_own_proposal(uuid, text, text, text, text, text, text, text, int, int)
  to authenticated;
