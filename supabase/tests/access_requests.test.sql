-- Access requests («Pide acceso»). Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

truncate public.photos, public.people, auth.users cascade;
truncate public.access_requests;

-- a = admin, b = user. n = the account created for an approved request (see below).
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

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
-- Asking: open to visitors, through the function only
-- ---------------------------------------------------------------------------

select pg_temp.act_as(null);
select throws_ok(
  $$ select public.request_access('Nadia Inventada', 'nadia@example.test', false) $$,
  'age_not_confirmed', 'the age box is required'
);
select throws_ok(
  $$ select public.request_access('  ', 'nadia@example.test', true) $$,
  'invalid_name', 'a name is required'
);
select throws_ok(
  $$ select public.request_access('Nadia Inventada', 'no-es-un-email', true) $$,
  'invalid_email', 'the email must look like one'
);
select lives_ok(
  $$ select public.request_access('Nadia Inventada', ' Nadia@Example.test ', true) $$,
  'a visitor asks for access'
);
select lives_ok(
  $$ select public.request_access('Nadia otra vez', 'nadia@example.test', true) $$,
  'asking twice gives the same answer'
);
select lives_ok(
  $$ select public.request_access('Ya tengo cuenta', 'b@example.test', true) $$,
  'an email with an account gives the same answer'
);
select throws_ok(
  $$ insert into public.access_requests (name, email, age_confirmed_at)
     values ('Directo', 'directo@example.test', now()) $$,
  '42501', null, 'visitors cannot insert directly'
);
select is((select count(*) from public.access_requests), 0::bigint,
  'visitors cannot read requests');

reset role;
select is(
  (select count(*) from public.access_requests), 1::bigint,
  'one pending request per email, none for existing accounts'
);
select ok(
  (select email = 'nadia@example.test' and age_confirmed_at is not null and status = 'pending'
   from public.access_requests),
  'stored with the email lowercased and the age confirmation'
);

-- ---------------------------------------------------------------------------
-- Reviewing: admins only
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*) from public.access_requests), 0::bigint, 'users cannot read requests');
select throws_ok(
  $$ select public.approve_access_request(
       (select id from public.access_requests limit 1), 'hash') $$,
  'not_allowed', 'users cannot approve'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*) from public.access_requests), 1::bigint, 'admins read requests');
select is(
  public.approve_access_request(
    (select id from public.access_requests limit 1), public.invitation_token_hash('tok-nadia')),
  'nadia@example.test', 'an admin approves and gets the email to send to'
);
select throws_ok(
  $$ select public.approve_access_request(
       (select id from public.access_requests limit 1), 'otro-hash') $$,
  'request_not_pending', 'a request is approved only once'
);
reset role;
select ok(
  (select i.role = 'user' and i.email = 'nadia@example.test' and i.person_id is null
     and i.invited_by = '00000000-0000-0000-0000-00000000000a'
   from public.access_requests r join public.invitations i on i.id = r.invitation_id),
  'approving creates a user invitation bound to the email'
);

-- The app then creates the account; accepting sets the name from the request.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000e', 'nadia@example.test', 'authenticated', 'authenticated');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select public.accept_invitation('tok-nadia');
reset role;
select ok(
  (select display_name = 'Nadia Inventada' and role = 'user'
     and invited_by = '00000000-0000-0000-0000-00000000000a'
   from public.profiles where id = '00000000-0000-0000-0000-00000000000e'),
  'accepting sets the requested name and «invitado por» the approving admin'
);

-- Rejecting.
select pg_temp.act_as(null);
select public.request_access('Spam Inventado', 'spam@example.test', true);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$ select public.reject_access_request(
       (select id from public.access_requests where email = 'spam@example.test')) $$,
  'an admin rejects'
);
reset role;
select is(
  (select count(*) from public.activity
   where action in ('access_request_approved', 'access_request_rejected')),
  2::bigint, 'decisions are recorded in activity'
);

select * from finish();
rollback;
