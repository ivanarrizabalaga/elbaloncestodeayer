-- Draft review helpers: draft_folders and photo_lookalikes. Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

truncate public.photos, public.people, auth.users cascade;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'user@example.test', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

-- Hashes: «a» and «b» differ in 2 bits, «c» is far from both.
insert into public.photos (id, slug, status, source_file, image_hash) values
  ('10000000-0000-0000-0000-000000000001', 'publicada', 'published', 'CAU/1.jpg', 'ffff000000000000'),
  ('10000000-0000-0000-0000-000000000002', 'borrador-1', 'draft', 'CAU/2.jpg', 'ffff000000000003'),
  ('10000000-0000-0000-0000-000000000003', 'borrador-2', 'draft', 'MIERES/3.jpg', '0000ffffffff0000'),
  ('10000000-0000-0000-0000-000000000004', 'descartada', 'rejected', 'CAU/4.jpg', 'ffff000000000001');

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

select results_eq(
  $$ select folder, photos from public.draft_folders order by folder $$,
  $$ values ('CAU', 1), ('MIERES', 1) $$,
  'an admin sees the draft folders with their counts (published and rejected left out)'
);

select results_eq(
  $$ select other_slug, bits from public.photo_lookalikes(array['10000000-0000-0000-0000-000000000002']::uuid[]) $$,
  $$ values ('publicada'::text, 2) $$,
  'an admin gets the lookalikes of a draft, without discarded photos'
);

select is_empty(
  $$ select 1 from public.photo_lookalikes(array['10000000-0000-0000-0000-000000000003']::uuid[]) $$,
  'a photo far from every other has no lookalikes'
);

select results_eq(
  $$ select other_slug from public.photo_lookalikes(array['10000000-0000-0000-0000-000000000001']::uuid[]) $$,
  $$ values ('borrador-1'::text) $$,
  'an admin also sees drafts among the lookalikes of a published photo'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');

select is_empty($$ select 1 from public.draft_folders $$, 'a user sees no draft folders');

select is_empty(
  $$ select 1 from public.photo_lookalikes(array['10000000-0000-0000-0000-000000000001']::uuid[]) $$,
  'a user does not learn about drafts through lookalikes'
);

-- A user's proposal of the same picture (close to «publicada» and «borrador-1»).
reset role;
insert into public.photos (id, slug, status, proposed_by, image_hash) values
  ('10000000-0000-0000-0000-000000000005', 'propuesta', 'proposed',
   '00000000-0000-0000-0000-00000000000b', 'ffff000000000007');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');

select results_eq(
  $$ select other_slug from public.photo_lookalikes(array['10000000-0000-0000-0000-000000000005']::uuid[]) $$,
  $$ values ('publicada'::text) $$,
  'a user proposing a photo sees the published lookalike, never the draft one'
);

select * from finish();
rollback;
