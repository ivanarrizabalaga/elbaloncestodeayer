-- Merging duplicate people. Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

truncate public.photos, public.people, auth.users cascade;

-- a = admin, b and c = users (b and c have each claimed a person).
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.test', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

-- 1 «Pepe García» stays; 2 «Pepe Garcia» is its duplicate (claimed by b, with a bio);
-- 3 was merged into 2 earlier; 4 is claimed by c.
insert into public.people (id, full_name, slug, claimed_by, bio) values
  ('00000000-0000-0000-0000-000000000001', 'Pepe García', 'pepe-garcia', null, null),
  ('00000000-0000-0000-0000-000000000002', 'Pepe Garcia', 'pepe-garcia-2',
   '00000000-0000-0000-0000-00000000000b', 'Base del Ribera'),
  ('00000000-0000-0000-0000-000000000003', 'Pepe G.', 'pepe-g', null, null),
  ('00000000-0000-0000-0000-000000000004', 'Luis Pérez', 'luis-perez',
   '00000000-0000-0000-0000-00000000000c', null);
update public.people set merged_into = '00000000-0000-0000-0000-000000000002'
  where id = '00000000-0000-0000-0000-000000000003';

insert into public.photos (id, slug, status) values
  ('00000000-0000-0000-0000-0000000000f1', 'foto-1', 'published');
insert into public.tags (photo_id, person_id, x, y, label_number) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000002', 0.5, 0.5, 1);
insert into public.invitations (token_hash, person_id) values
  ('hash-2', '00000000-0000-0000-0000-000000000002');

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

-- ---------------------------------------------------------------------------
-- Admins only
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$ select public.merge_people('00000000-0000-0000-0000-000000000002',
                                '00000000-0000-0000-0000-000000000001') $$,
  'not_allowed', 'users cannot merge people'
);

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$ select public.merge_people('00000000-0000-0000-0000-000000000001',
                                '00000000-0000-0000-0000-000000000001') $$,
  'same_person', 'a person cannot be merged into itself'
);
select throws_ok(
  $$ select public.merge_people('00000000-0000-0000-0000-000000000003',
                                '00000000-0000-0000-0000-000000000001') $$,
  'person_not_found', 'an already merged person cannot be merged again'
);
select throws_ok(
  $$ select public.merge_people('00000000-0000-0000-0000-000000000002',
                                '00000000-0000-0000-0000-000000000004') $$,
  'both_claimed', 'two people linked to accounts cannot be merged'
);

-- ---------------------------------------------------------------------------
-- Merge 2 into 1
-- ---------------------------------------------------------------------------

select is(
  public.merge_people('00000000-0000-0000-0000-000000000002',
                      '00000000-0000-0000-0000-000000000001'),
  'pepe-garcia', 'returns the slug of the person that stays'
);
reset role;
select is(
  (select merged_into from public.people where id = '00000000-0000-0000-0000-000000000002'),
  '00000000-0000-0000-0000-000000000001'::uuid, 'the duplicate points at the target'
);
select is(
  (select merged_into from public.people where id = '00000000-0000-0000-0000-000000000003'),
  '00000000-0000-0000-0000-000000000001'::uuid, 'earlier duplicates point at the target too'
);
select is(
  (select claimed_by from public.people where id = '00000000-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-00000000000b'::uuid, 'the account link moves to the target'
);
select is(
  (select claimed_by from public.people where id = '00000000-0000-0000-0000-000000000002'),
  null, 'and leaves the duplicate'
);
select is(
  (select bio from public.people where id = '00000000-0000-0000-0000-000000000001'),
  'Base del Ribera', 'the bio is kept when the target had none'
);
select is(
  (select count(*) from public.tags where person_id = '00000000-0000-0000-0000-000000000001'),
  1::bigint, 'tags move to the target'
);
select is(
  (select count(*) from public.invitations where person_id = '00000000-0000-0000-0000-000000000001'),
  1::bigint, 'invitations move to the target'
);
select is(
  (select count(*) from public.activity where action = 'people_merged'),
  1::bigint, 'the merge is recorded in activity'
);

select * from finish();
rollback;
