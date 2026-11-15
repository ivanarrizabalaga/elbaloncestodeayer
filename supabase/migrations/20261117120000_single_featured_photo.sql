-- Phase 6: «Foto de la semana». Only one photo is featured at a time: featuring a photo
-- unfeatures the previous one (trigger), and a partial unique index guarantees it.

-- Keep the most recently published of the photos featured today.
update public.photos set featured = false
where featured and id <> (
  select id from public.photos where featured
  order by published_at desc nulls last limit 1
);

create function public.unfeature_other_photos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.photos set featured = false where featured and id <> new.id;
  return new;
end;
$$;

create trigger photos_single_featured
  before insert or update of featured on public.photos
  for each row when (new.featured)
  execute function public.unfeature_other_photos();

create unique index photos_single_featured_idx on public.photos (featured) where featured;
