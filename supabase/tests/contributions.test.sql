-- User contributions on a photo (phase 5.2). Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

truncate public.photos, public.people, auth.users cascade;

-- a = admin, b = user linked to Pepe, c = another user, d = blocked.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'd@example.test', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set blocked_at = now() where id = '00000000-0000-0000-0000-00000000000d';

insert into public.photos (id, slug, status) values
  ('10000000-0000-0000-0000-000000000001', 'publicada', 'published'),
  ('10000000-0000-0000-0000-000000000002', 'borrador', 'draft');
insert into public.people (id, full_name, slug, claimed_by) values
  ('20000000-0000-0000-0000-000000000001', 'Pepe', 'pepe', '00000000-0000-0000-0000-00000000000b'),
  ('20000000-0000-0000-0000-000000000002', 'Luis', 'luis', null);
insert into public.tags (id, photo_id, person_id, x, y, label_number) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 0.2, 0.3, 1),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000002', 0.4, 0.3, 2);

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
-- Tagging
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select lives_ok(
  $$ insert into public.tags (photo_id, person_id, x, y, label_number, created_by)
     values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
             0.6, 0.3, 3, '00000000-0000-0000-0000-00000000000c') $$,
  'a user tags an existing person on a published photo'
);
select throws_ok(
  $$ insert into public.tags (photo_id, person_id, x, y, label_number, created_by)
     values ('10000000-0000-0000-0000-000000000002', null, 0.6, 0.3, 1,
             '00000000-0000-0000-0000-00000000000c') $$,
  '42501', null, 'users cannot tag drafts'
);
select throws_ok(
  $$ insert into public.people (full_name, slug) values ('Nuevo', 'nuevo') $$,
  '42501', null, 'users cannot create people'
);
reset role;
select is(
  (select count(*) from public.activity where action = 'tag_added'),
  1::bigint,
  'a user tag is recorded in activity'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select throws_ok(
  $$ insert into public.tags (photo_id, person_id, x, y, label_number, created_by)
     values ('10000000-0000-0000-0000-000000000001', null, 0.8, 0.3, 4,
             '00000000-0000-0000-0000-00000000000d') $$,
  '42501', null, 'blocked users cannot tag'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.tags (photo_id, person_id, x, y, label_number, created_by)
values ('10000000-0000-0000-0000-000000000001', null, 0.8, 0.6, 5, '00000000-0000-0000-0000-00000000000a');
reset role;
select is(
  (select count(*) from public.activity where action = 'tag_added'),
  1::bigint,
  'admin tags are not recorded as contributions'
);

-- ---------------------------------------------------------------------------
-- Name suggestions go to review
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select lives_ok(
  $$ insert into public.review_items (kind, tag_id, created_by, payload)
     values ('name_suggestion', '30000000-0000-0000-0000-000000000002',
             '00000000-0000-0000-0000-00000000000c', '{"name":"Luis Otro"}') $$,
  'a user suggests a name'
);

-- ---------------------------------------------------------------------------
-- «Quitar mi etiqueta»
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.remove_own_tag('30000000-0000-0000-0000-000000000001') $$,
  'not_allowed', 'nobody else can remove your tag'
);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$ select public.remove_own_tag('30000000-0000-0000-0000-000000000002') $$,
  'not_allowed', 'you can only remove tags of your own person'
);
select lives_ok(
  $$ select public.remove_own_tag('30000000-0000-0000-0000-000000000001') $$,
  'b removes their own tag'
);
reset role;
select ok(
  (select removed_at is not null and removed_by = '00000000-0000-0000-0000-00000000000b'
   from public.tags where id = '30000000-0000-0000-0000-000000000001'),
  'the tag is soft-deleted by b'
);
select ok(
  exists (select 1 from public.activity where action = 'own_tag_removed'),
  'removing your tag is recorded in activity'
);
select pg_temp.act_as(null);
select throws_ok(
  $$ select public.remove_own_tag('30000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'visitors cannot call remove_own_tag'
);

-- ---------------------------------------------------------------------------
-- Memories
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
insert into public.memories (id, photo_id, author_id, body)
values ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-00000000000c', 'Qué tiempos');
reset role;
select ok(
  exists (select 1 from public.activity where action = 'memory_added'),
  'a user memory is recorded in activity'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
update public.memories set body = 'Editado por otro' where id = '50000000-0000-0000-0000-000000000001';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select is(
  (select body from public.memories where id = '50000000-0000-0000-0000-000000000001'),
  'Qué tiempos',
  'nobody else can edit your memory'
);
update public.memories set body = 'Qué tiempos aquellos' where id = '50000000-0000-0000-0000-000000000001';
select is(
  (select body from public.memories where id = '50000000-0000-0000-0000-000000000001'),
  'Qué tiempos aquellos',
  'the author edits their memory'
);
delete from public.memories where id = '50000000-0000-0000-0000-000000000001';
select is_empty(
  $$ select 1 from public.memories where id = '50000000-0000-0000-0000-000000000001' $$,
  'the author deletes their memory'
);

select * from finish();
rollback;
