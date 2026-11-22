-- Choosing a person's featured photo. Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

truncate public.photos, public.people, auth.users cascade;

-- a = admin, b = the account linked to person 1, c = another user.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.test', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

insert into public.people (id, full_name, slug, claimed_by) values
  ('00000000-0000-0000-0000-000000000001', 'Pepe García', 'pepe-garcia',
   '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-000000000002', 'Luis Pérez', 'luis-perez', null);

insert into public.photos (id, slug, status) values
  ('00000000-0000-0000-0000-0000000000f1', 'foto-1', 'published'),
  ('00000000-0000-0000-0000-0000000000f2', 'foto-2', 'draft');
-- t1: Pepe on a published photo; t2: Pepe on a draft; t3: Luis.
insert into public.tags (id, photo_id, person_id, x, y, label_number) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-000000000001', 0.5, 0.5, 1),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000f2',
   '00000000-0000-0000-0000-000000000001', 0.5, 0.5, 1),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-000000000002', 0.2, 0.5, 2);

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

-- Another user cannot choose someone else's photo.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$ select public.set_person_portrait('00000000-0000-0000-0000-000000000001',
                                       '00000000-0000-0000-0000-0000000000a1') $$,
  'not_allowed', 'other users cannot choose the featured photo'
);

-- The person themselves can, only among their own tags on published photos.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok(
  $$ select public.set_person_portrait('00000000-0000-0000-0000-000000000001',
                                       '00000000-0000-0000-0000-0000000000a1') $$,
  'the person can choose their featured photo'
);
select throws_ok(
  $$ select public.set_person_portrait('00000000-0000-0000-0000-000000000001',
                                       '00000000-0000-0000-0000-0000000000a3') $$,
  'tag_not_found', 'not a tag of someone else'
);
select throws_ok(
  $$ select public.set_person_portrait('00000000-0000-0000-0000-000000000001',
                                       '00000000-0000-0000-0000-0000000000a2') $$,
  'tag_not_found', 'not a tag on an unpublished photo'
);
reset role;
select is(
  (select portrait_tag_id from public.people where id = '00000000-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'the choice is saved'
);

-- A blocked account cannot.
update public.profiles set blocked_at = now() where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$ select public.set_person_portrait('00000000-0000-0000-0000-000000000001', null) $$,
  'not_allowed', 'blocked accounts cannot choose'
);

-- An admin can, for anyone, and null goes back to the default.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$ select public.set_person_portrait('00000000-0000-0000-0000-000000000001', null) $$,
  'admins can choose for anyone'
);
reset role;
select is(
  (select portrait_tag_id from public.people where id = '00000000-0000-0000-0000-000000000001'),
  null, 'null goes back to the default'
);

select * from finish();
rollback;
