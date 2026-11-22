-- Mentions in memories: the trigger that queues them and who may read or change what.
-- Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

truncate public.photos, public.people, auth.users cascade;
-- The cascade empties mention_settings too (updated_by references profiles).
insert into public.mention_settings default values on conflict do nothing;

-- a = admin, b = author, c and d = people with an account, e = person without one.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'd@example.test', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

insert into public.people (id, full_name, slug, claimed_by) values
  ('20000000-0000-0000-0000-00000000000b', 'Berta', 'berta', '00000000-0000-0000-0000-00000000000b'),
  ('20000000-0000-0000-0000-00000000000c', 'Carlos', 'carlos', '00000000-0000-0000-0000-00000000000c'),
  ('20000000-0000-0000-0000-00000000000d', 'Dani', 'dani', '00000000-0000-0000-0000-00000000000d'),
  ('20000000-0000-0000-0000-00000000000e', 'Elena', 'elena', null);
insert into public.photos (id, slug, status) values
  ('10000000-0000-0000-0000-000000000001', 'foto', 'published');

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

create function pg_temp.queued(p_memory uuid) returns text language sql as $$
  select coalesce(string_agg(right(profile_id::text, 1), ',' order by profile_id), '')
  from public.memory_mentions where memory_id = p_memory;
$$;

-- The trigger: only accounts, never the author, each person once.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into public.memories (id, photo_id, author_id, body) values (
  '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-00000000000b',
  'Con @[Carlos](20000000-0000-0000-0000-00000000000c), @[Carlos](20000000-0000-0000-0000-00000000000c), '
  || '@[Elena](20000000-0000-0000-0000-00000000000e) y yo, @[Berta](20000000-0000-0000-0000-00000000000b).'
);
reset role;
select is(pg_temp.queued('40000000-0000-0000-0000-000000000001'), 'c',
  'a mention queues the person''s account, once; not people without one, nor the author');

-- Editing: an added mention is queued, a removed one that is still pending goes away.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
update public.memories
  set body = 'Ahora con @[Dani](20000000-0000-0000-0000-00000000000d).'
  where id = '40000000-0000-0000-0000-000000000001';
reset role;
select is(pg_temp.queued('40000000-0000-0000-0000-000000000001'), 'd',
  'editing adds new mentions and drops pending ones taken out');

-- Already notified: kept, and not queued again by another edit.
update public.memory_mentions set notified_at = now()
  where memory_id = '40000000-0000-0000-0000-000000000001';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
update public.memories
  set body = 'Con @[Dani](20000000-0000-0000-0000-00000000000d), otra vez.'
  where id = '40000000-0000-0000-0000-000000000001';
reset role;
select is(
  (select count(*)::int from public.memory_mentions
    where memory_id = '40000000-0000-0000-0000-000000000001' and notified_at is null),
  0, 'an edit does not notify again someone already notified'
);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
update public.memories set body = 'Sin menciones.'
  where id = '40000000-0000-0000-0000-000000000001';
reset role;
select is(pg_temp.queued('40000000-0000-0000-0000-000000000001'), 'd',
  'a notified mention stays recorded after it is taken out');

-- Deleting the memory deletes its mentions.
insert into public.memories (id, photo_id, author_id, body) values (
  '40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-00000000000b', 'Hola @[Carlos](20000000-0000-0000-0000-00000000000c)');
delete from public.memories where id = '40000000-0000-0000-0000-000000000002';
select is(pg_temp.queued('40000000-0000-0000-0000-000000000002'), '',
  'deleting a memory deletes its mentions');

insert into public.mention_emails (profile_id, mentions)
  values ('00000000-0000-0000-0000-00000000000d', 1);

-- Users and visitors see none of it.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.memory_mentions), 0, 'a user cannot read mentions, even their own');
select is((select count(*)::int from public.mention_emails), 0, 'a user cannot read the email log');
select is((select count(*)::int from public.mention_settings), 0, 'a user cannot read the settings');
select throws_ok(
  $$ insert into public.memory_mentions (memory_id, profile_id) values
     ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c') $$,
  '42501', null, 'a user cannot queue mentions by hand');
select throws_ok(
  $$ insert into public.mention_emails (profile_id, mentions) values (null, 1) $$,
  '42501', null, 'a user cannot write to the email log');
update public.mention_settings set paused = true;
reset role;
select is((select paused from public.mention_settings), false, 'a user cannot pause the emails');

select pg_temp.act_as(null);
select throws_ok($$ select * from public.memory_mentions $$, '42501', null,
  'visitors cannot read mentions');

-- Opt-out: your own account only.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
update public.profiles set mention_emails = false where id = '00000000-0000-0000-0000-00000000000d';
update public.profiles set mention_emails = false where id = '00000000-0000-0000-0000-00000000000c';
reset role;
select is(
  (select string_agg(right(id::text, 1), ',' order by id) from public.profiles where not mention_emails),
  'd', 'a user can turn off their own mention emails, not someone else''s');

-- Admins read the counts and flip the switch.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.memory_mentions), 1, 'an admin reads mentions');
select is((select count(*)::int from public.mention_emails), 1, 'an admin reads the email log');
update public.mention_settings set paused = true, updated_by = '00000000-0000-0000-0000-00000000000a';
reset role;
select is((select paused from public.mention_settings), true, 'an admin can pause the emails');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$ insert into public.mention_emails (profile_id, mentions) values (null, 1) $$,
  '42501', null, 'not even an admin writes to the email log (only the digest does)');
reset role;

select * from finish();
rollback;
