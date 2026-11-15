-- Review queue and Recent activity (phase 5.3): only admins work them. Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

truncate public.photos, public.people, auth.users cascade;

-- a = admin, b = user who filed a suggestion and claimed Pepe.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

insert into public.photos (id, slug, status) values
  ('10000000-0000-0000-0000-000000000001', 'publicada', 'published');
insert into public.people (id, full_name, slug, claimed_by) values
  ('20000000-0000-0000-0000-000000000001', 'Pepe', 'pepe', '00000000-0000-0000-0000-00000000000b');
insert into public.review_items (id, kind, photo_id, payload, created_by) values
  ('40000000-0000-0000-0000-000000000001', 'name_suggestion', '10000000-0000-0000-0000-000000000001',
   '{"name":"Luis"}', '00000000-0000-0000-0000-00000000000b');
insert into public.activity (actor_id, action, target_type, target_id) values
  ('00000000-0000-0000-0000-00000000000b', 'person_claimed', 'person', '20000000-0000-0000-0000-000000000001');

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
end;
$$;

-- A user sees their own suggestion but cannot resolve, assign or read activity.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*) from public.review_items), 1::bigint, 'a user sees their own item');
update public.review_items set status = 'resolved' where id = '40000000-0000-0000-0000-000000000001';
update public.review_items set assigned_to = '00000000-0000-0000-0000-00000000000b'
  where id = '40000000-0000-0000-0000-000000000001';
select is_empty($$ select 1 from public.activity $$, 'users cannot read activity');
reset role;
select is(
  (select status::text from public.review_items where id = '40000000-0000-0000-0000-000000000001'),
  'open', 'users cannot resolve review items'
);
select ok(
  (select assigned_to is null from public.review_items where id = '40000000-0000-0000-0000-000000000001'),
  'users cannot take review items'
);

-- The user cannot release their claim through a plain update either (people: admin update).
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
update public.people set claimed_by = null where id = '20000000-0000-0000-0000-000000000001';
reset role;
select ok(
  (select claimed_by is not null from public.people where id = '20000000-0000-0000-0000-000000000001'),
  'users cannot change claims directly'
);

-- Admins read activity, take, resolve and undo a claim.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*) from public.activity), 1::bigint, 'admins read activity');
update public.review_items set assigned_to = '00000000-0000-0000-0000-00000000000a'
  where id = '40000000-0000-0000-0000-000000000001';
update public.review_items set status = 'resolved', resolved_by = '00000000-0000-0000-0000-00000000000a',
  resolved_at = now() where id = '40000000-0000-0000-0000-000000000001';
update public.people set claimed_by = null where id = '20000000-0000-0000-0000-000000000001';
reset role;
select ok(
  (select assigned_to = '00000000-0000-0000-0000-00000000000a'
   from public.review_items where id = '40000000-0000-0000-0000-000000000001'),
  'an admin takes an item'
);
select is(
  (select status::text from public.review_items where id = '40000000-0000-0000-0000-000000000001'),
  'resolved', 'an admin resolves an item'
);
select ok(
  (select claimed_by is null from public.people where id = '20000000-0000-0000-0000-000000000001'),
  'an admin undoes a claim'
);

select * from finish();
rollback;
