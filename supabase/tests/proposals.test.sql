-- Proposing photos and withdrawing your own (phase 5.4). Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

truncate public.photos, public.people, auth.users cascade;

-- a = admin, b = user who proposes, c = another user, d = blocked user.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'd@example.test', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

-- d proposed a photo that was published before being blocked.
insert into public.photos (id, slug, status, proposed_by) values
  ('10000000-0000-0000-0000-00000000000d', 'de-d', 'published', '00000000-0000-0000-0000-00000000000d');
update public.profiles set blocked_at = now() where id = '00000000-0000-0000-0000-00000000000d';

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
-- Proposing
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok(
  $$ insert into public.photos (id, slug, status, proposed_by) values
     ('10000000-0000-0000-0000-000000000001', 'propuesta-1', 'proposed', '00000000-0000-0000-0000-00000000000b'),
     ('10000000-0000-0000-0000-000000000002', 'propuesta-2', 'proposed', '00000000-0000-0000-0000-00000000000b') $$,
  'a user proposes photos'
);
select lives_ok(
  $$ insert into public.review_items (kind, photo_id, created_by, payload) values
     ('photo_proposal', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '{"comment":"del 82"}') $$,
  'with a photo_proposal item'
);
select throws_ok(
  $$ insert into public.photos (slug, status, proposed_by)
     values ('directa', 'published', '00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'users cannot publish directly'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is_empty(
  $$ select 1 from public.photos where id = '10000000-0000-0000-0000-000000000001' $$,
  'other users do not see a proposal'
);

select pg_temp.act_as(null);
select is_empty(
  $$ select 1 from public.photos where status = 'proposed' $$,
  'visitors do not see proposals'
);
select lives_ok(
  $$ insert into public.review_items (kind, photo_id, payload)
     values ('removal_request', '10000000-0000-0000-0000-00000000000d', '{"reason":"salgo yo"}') $$,
  'a visitor requests a withdrawal'
);

-- ---------------------------------------------------------------------------
-- withdraw_own_photo
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$ select public.withdraw_own_photo('10000000-0000-0000-0000-000000000001') $$,
  'not_allowed', 'nobody else can withdraw your photo'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is(
  public.withdraw_own_photo('10000000-0000-0000-0000-000000000001'),
  'deleted', 'an unpublished proposal is deleted'
);
reset role;
select is_empty(
  $$ select 1 from public.review_items where photo_id = '10000000-0000-0000-0000-000000000001' $$,
  'its review item goes with it'
);

-- An admin publishes the second one; b then withdraws it.
update public.photos set status = 'published' where id = '10000000-0000-0000-0000-000000000002';
insert into public.memories (photo_id, author_id, body)
values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'Qué recuerdos');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is(
  public.withdraw_own_photo('10000000-0000-0000-0000-000000000002'),
  'withdrawn', 'a published photo is withdrawn'
);
reset role;
select is(
  (select count(*) from public.memories where photo_id = '10000000-0000-0000-0000-000000000002'),
  1::bigint, 'the memories of others are kept'
);
select ok(
  exists (select 1 from public.activity where action = 'own_photo_withdrawn'),
  'withdrawing is recorded in activity'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select is(
  public.withdraw_own_photo('10000000-0000-0000-0000-00000000000d'),
  'withdrawn', 'a blocked user can still withdraw their photo'
);

select pg_temp.act_as(null);
select throws_ok(
  $$ select public.withdraw_own_photo('10000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'visitors cannot call withdraw_own_photo'
);

select * from finish();
rollback;
