-- Invitations and claims (phase 5.1). Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

truncate public.photos, public.people, auth.users cascade;

-- Accounts: a = admin (inviter), b and c = users, d = blocked.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'd@example.test', 'authenticated', 'authenticated');
update public.profiles set role = 'admin', display_name = 'Admin' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set blocked_at = now() where id = '00000000-0000-0000-0000-00000000000d';

insert into public.photos (id, slug, status, storage_key, width, height) values
  ('10000000-0000-0000-0000-000000000001', 'foto', 'published', 'seed/team-1.svg', 1200, 800);
insert into public.people (id, full_name, slug) values
  ('20000000-0000-0000-0000-000000000001', 'Pepe Inventado', 'pepe-inventado'),
  ('20000000-0000-0000-0000-000000000002', 'Luis Inventado', 'luis-inventado'),
  ('20000000-0000-0000-0000-000000000003', 'Ana Inventada', 'ana-inventada');
insert into public.tags (id, photo_id, person_id, x, y, label_number) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 0.2, 0.3, 1);

insert into public.invitations (id, token_hash, role, person_id, tag_id, invited_by, expires_at) values
  ('40000000-0000-0000-0000-000000000001', public.invitation_token_hash('tok-pepe'), 'user',
   '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-00000000000a', now() + interval '7 days'),
  ('40000000-0000-0000-0000-000000000002', public.invitation_token_hash('tok-old'), 'user',
   '20000000-0000-0000-0000-000000000002', null,
   '00000000-0000-0000-0000-00000000000a', now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000003', public.invitation_token_hash('tok-luis'), 'user',
   '20000000-0000-0000-0000-000000000002', null,
   '00000000-0000-0000-0000-00000000000a', now() + interval '7 days'),
  ('40000000-0000-0000-0000-000000000004', public.invitation_token_hash('tok-admin'), 'admin',
   null, null, '00000000-0000-0000-0000-00000000000a', now() + interval '7 days');

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
-- Preview (visitor)
-- ---------------------------------------------------------------------------

select pg_temp.act_as(null);

select results_eq(
  $$ select status, person_name, inviter_name, photo_slug from public.invitation_preview('tok-pepe') $$,
  $$ values ('valid', 'Pepe Inventado', 'Admin', 'foto') $$,
  'a visitor previews a valid invitation with person, inviter and photo'
);
select is((select status from public.invitation_preview('tok-old')), 'expired', 'expired invitations say so');
select is_empty($$ select * from public.invitation_preview('nope') $$, 'unknown tokens return nothing');
select throws_ok(
  $$ select public.accept_invitation('tok-pepe') $$,
  '42501', null, 'visitors cannot accept invitations'
);
select is_empty($$ select * from public.invitations $$, 'visitors cannot read invitations');

-- «No soy yo»
select lives_ok($$ select public.dispute_invitation('tok-pepe', 'Otro Nombre') $$, 'a visitor can dispute');
select lives_ok($$ select public.dispute_invitation('tok-pepe', 'Otra vez') $$, 'disputing twice is harmless');
reset role;
select is(
  (select count(*) from public.review_items where kind = 'tag_dispute'),
  1::bigint,
  'only one open dispute per invitation'
);
select is(
  (select payload ->> 'suggested_name' from public.review_items where kind = 'tag_dispute'),
  'Otro Nombre',
  'the dispute keeps the suggested name'
);

-- ---------------------------------------------------------------------------
-- Accepting
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.accept_invitation('tok-pepe') $$, 'not_allowed', 'blocked users cannot accept');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.accept_invitation('tok-old') $$, 'invitation_expired', 'expired invitations fail');
select is(public.accept_invitation('tok-pepe'), 'pepe-inventado', 'b accepts and gets the person slug');
reset role;
select is(
  (select claimed_by from public.people where slug = 'pepe-inventado'),
  '00000000-0000-0000-0000-00000000000b'::uuid,
  'the person is linked to b'
);
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'Pepe Inventado',
  'an empty display name takes the person name'
);
select ok(
  exists (select 1 from public.activity where action = 'invitation_accepted'),
  'accepting is recorded in activity'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok($$ select public.accept_invitation('tok-pepe') $$, 'invitation_used', 'an invitation works once');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$ select public.accept_invitation('tok-luis') $$,
  'account_already_linked',
  'an account links to one person only'
);

-- ---------------------------------------------------------------------------
-- «Este soy yo» and admin invitations
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.claim_person('20000000-0000-0000-0000-000000000003') $$,
  'account_already_linked',
  'b cannot claim a second person'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$ select public.claim_person('20000000-0000-0000-0000-000000000001') $$,
  'person_already_claimed',
  'c cannot claim a person someone else claimed'
);
select is(
  public.claim_person('20000000-0000-0000-0000-000000000003'),
  'ana-inventada',
  'c claims an unclaimed person'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is(public.accept_invitation('tok-admin'), null, 'an admin invitation without a person has no slug');
reset role;
select is(
  (select role from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
  'admin'::public.user_role,
  'an admin invitation promotes the account'
);

select * from finish();
rollback;
