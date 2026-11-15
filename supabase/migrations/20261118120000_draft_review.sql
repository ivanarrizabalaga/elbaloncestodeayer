-- Helpers for reviewing drafts in bulk (/admin/subir, table view).
--
-- draft_folders: the top-level folder of each imported draft (source_file «CAU/x.jpg» ->
--   «CAU») and how many drafts it has, for the folder filter.
-- photo_lookalikes: for the given photos, the other photos whose image_hash is at most
--   max_bits bits away (probably the same picture: a scan and a phone photo of one print,
--   a screenshot…). Discarded (rejected) photos are left out.
--
-- Both run as the caller (security invoker), so the photos policies apply: admins see
-- drafts; anyone else only sees published photos and their own proposals.

create view public.draft_folders with (security_invoker = true) as
  select split_part(source_file, '/', 1) as folder, count(*)::int as photos
  from public.photos
  where status = 'draft' and source_file like '%/%'
  group by 1;

revoke all on public.draft_folders from anon, authenticated;
grant select on public.draft_folders to authenticated;

create function public.photo_lookalikes(photo_ids uuid[], max_bits int default 12)
returns table (
  photo_id uuid,
  other_id uuid,
  other_slug text,
  other_status public.photo_status,
  bits int
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, o.id, o.slug, o.status, d.bits
  from public.photos p
  join public.photos o
    on o.id <> p.id and o.image_hash is not null and o.status <> 'rejected'
  cross join lateral (
    select bit_count(('x' || p.image_hash)::bit(64) # ('x' || o.image_hash)::bit(64))::int as bits
  ) d
  where p.id = any (photo_ids) and p.image_hash is not null and d.bits <= max_bits
  order by p.id, d.bits;
$$;

revoke execute on function public.photo_lookalikes(uuid[], int) from public, anon, authenticated;
grant execute on function public.photo_lookalikes(uuid[], int) to authenticated;
