-- Users and admins (phase 5.5). Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

truncate public.photos, public.people, auth.users cascade;

-- a = the only admin, b and c = users.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.test', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

-- An admin invitation sent to c (token 'para-c').
insert into public.invitations (token_hash, role, email, invited_by) values
  (public.invitation_token_hash('para-c'), 'admin', 'c@example.test', '00000000-0000-0000-0000-00000000000a');

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
-- Listing accounts (with emails): admins only
-- ---------------------------------------------------------------------------

select pg_temp.act_as(null);
select throws_ok($$ select * from public.admin_user_list() $$, '42501', null,
  'visitors cannot list accounts');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select * from public.admin_user_list() $$, 'not_allowed',
  'users cannot list accounts');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*) from public.admin_user_list()), 3::bigint, 'admins list every account');
select is(
  (select email from public.admin_user_list() where id = '00000000-0000-0000-0000-00000000000b'),
  'b@example.test', 'with their email'
);

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$ select public.set_user_role('00000000-0000-0000-0000-00000000000b', 'admin') $$,
  'not_allowed', 'users cannot make themselves admin'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$ select public.set_user_role('00000000-0000-0000-0000-00000000000a', 'user') $$,
  'There must always be at least one admin', 'the last admin cannot step down'
);
select lives_ok(
  $$ select public.set_user_role('00000000-0000-0000-0000-00000000000b', 'admin') $$,
  'an admin makes another admin'
);
select lives_ok(
  $$ select public.set_user_role('00000000-0000-0000-0000-00000000000a', 'user') $$,
  'with another admin around, an admin can step down'
);
reset role;
select ok(
  exists (select 1 from public.activity where action = 'role_changed'),
  'role changes are recorded in activity'
);

-- ---------------------------------------------------------------------------
-- Blocking (b is now the admin)
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$ select public.set_user_blocked('00000000-0000-0000-0000-00000000000b', true) $$,
  'not_allowed', 'admins cannot block themselves'
);
select lives_ok(
  $$ select public.set_user_blocked('00000000-0000-0000-0000-00000000000a', true) $$,
  'an admin blocks a user'
);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$ select public.set_user_blocked('00000000-0000-0000-0000-00000000000b', true) $$,
  'not_allowed', 'a blocked account cannot block anyone'
);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok(
  $$ select public.set_user_blocked('00000000-0000-0000-0000-00000000000a', false) $$,
  'an admin unblocks'
);

-- ---------------------------------------------------------------------------
-- Admin invitations: only the email they were sent to can accept them
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$ select public.accept_invitation('para-c') $$,
  'invitation_other_email', 'another account cannot use the invitation'
);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select lives_ok($$ select public.accept_invitation('para-c') $$, 'c accepts it');
reset role;
select ok(
  (select role = 'admin' and invited_by = '00000000-0000-0000-0000-00000000000a'
   from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
  'c is now an admin, invited by a'
);

select * from finish();
rollback;
