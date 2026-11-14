-- RLS tests (SPEC.md §2). Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres, bypassing RLS)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'user@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'blocked@example.test', 'authenticated', 'authenticated');

select is(
  (select count(*) from public.profiles),
  3::bigint,
  'a profile is created for every new auth user'
);

update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set blocked_at = now() where id = '00000000-0000-0000-0000-00000000000c';

insert into public.photos (id, slug, status) values
  ('10000000-0000-0000-0000-000000000001', 'published-photo', 'published'),
  ('10000000-0000-0000-0000-000000000002', 'draft-photo', 'draft');

insert into public.people (id, full_name, slug) values
  ('20000000-0000-0000-0000-000000000001', 'Pepe Inventado', 'pepe-inventado');

-- Helper: act as a given user (null = anonymous visitor).
create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  reset role;
  if p_user is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
  else
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', p_user, 'role', 'authenticated')::text,
      true
    );
    set local role authenticated;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Visitor
-- ---------------------------------------------------------------------------

select pg_temp.act_as(null);

select is((select count(*) from public.photos), 1::bigint, 'visitor sees only published photos');
select is((select count(*) from public.profiles), 0::bigint, 'visitor cannot read profiles');
select lives_ok(
  'select id, display_name from public.profile_names',
  'visitor can read public profile names'
);
select is((select count(*) from public.people), 1::bigint, 'visitor can read people');
select throws_ok(
  $$insert into public.photos (slug, status) values ('x', 'proposed')$$,
  '42501',
  null,
  'visitor cannot propose photos'
);
select lives_ok(
  $$insert into public.review_items (kind, photo_id, payload)
    values ('removal_request', '10000000-0000-0000-0000-000000000001', '{"reason":"test"}')$$,
  'visitor can request a photo withdrawal'
);
select is((select count(*) from public.review_items), 0::bigint, 'visitor cannot read the review queue');

-- ---------------------------------------------------------------------------
-- User
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');

select is((select count(*) from public.photos), 1::bigint, 'user does not see drafts');
select is((select count(*) from public.profiles), 1::bigint, 'user sees only their own profile');
select lives_ok(
  $$insert into public.photos (slug, status, proposed_by)
    values ('user-proposal', 'proposed', '00000000-0000-0000-0000-00000000000b')$$,
  'user can propose a photo'
);
select throws_ok(
  $$insert into public.photos (slug, status, proposed_by)
    values ('sneaky', 'published', '00000000-0000-0000-0000-00000000000b')$$,
  '42501',
  null,
  'user cannot publish a photo'
);
select lives_ok(
  $$update public.profiles set display_name = 'Pepe' where id = '00000000-0000-0000-0000-00000000000b'$$,
  'user can change their display name'
);
select throws_ok(
  $$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000b'$$,
  '42501',
  null,
  'user cannot make themselves admin'
);
select lives_ok(
  $$insert into public.tags (photo_id, person_id, x, y, label_number, created_by)
    values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
            0.5, 0.5, 1, '00000000-0000-0000-0000-00000000000b')$$,
  'user can tag someone in a published photo'
);
select throws_ok(
  $$insert into public.tags (photo_id, x, y, label_number, created_by)
    values ('10000000-0000-0000-0000-000000000002', 0.5, 0.5, 1, '00000000-0000-0000-0000-00000000000b')$$,
  '42501',
  null,
  'user cannot tag a draft photo'
);
select throws_ok(
  $$insert into public.invitations (token_hash, role, invited_by)
    values ('hash-1', 'admin', '00000000-0000-0000-0000-00000000000b')$$,
  '42501',
  null,
  'user cannot invite an admin'
);

-- ---------------------------------------------------------------------------
-- Blocked user
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');

select throws_ok(
  $$insert into public.memories (photo_id, author_id, body)
    values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'Hola')$$,
  '42501',
  null,
  'blocked user cannot add memories'
);

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

select is((select count(*) from public.photos), 3::bigint, 'admin sees every photo');
select is((select count(*) from public.profiles), 3::bigint, 'admin sees every profile');

-- ---------------------------------------------------------------------------
-- Database rules
-- ---------------------------------------------------------------------------

reset role;

select throws_ok(
  $$update public.profiles set role = 'user' where id = '00000000-0000-0000-0000-00000000000a'$$,
  'P0001',
  'There must always be at least one admin',
  'the last admin cannot be demoted'
);
select is(
  (select priority from public.review_items where kind = 'removal_request'),
  true,
  'withdrawal requests are always priority'
);

select * from finish();
rollback;
