-- «Foto de la semana»: only one featured photo (phase 6). Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

truncate public.photos, public.people, auth.users cascade;
insert into public.photos (id, slug, status, featured) values
  ('10000000-0000-0000-0000-000000000001', 'una', 'published', true),
  ('10000000-0000-0000-0000-000000000002', 'otra', 'published', false);

update public.photos set featured = true where id = '10000000-0000-0000-0000-000000000002';
select is(
  (select array_agg(slug) from public.photos where featured),
  array['otra'],
  'featuring a photo unfeatures the previous one'
);

update public.photos set featured = false where id = '10000000-0000-0000-0000-000000000002';
select is_empty($$ select 1 from public.photos where featured $$, 'it can be left with none');

insert into public.photos (slug, status, featured) values ('nueva', 'published', true);
select is(
  (select count(*) from public.photos where featured), 1::bigint,
  'a new featured photo is still the only one'
);

select * from finish();
rollback;
