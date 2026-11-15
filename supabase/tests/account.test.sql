-- «Borrar mi cuenta» (phase 6). Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

truncate public.photos, public.people, auth.users cascade;

-- a = the only admin, b = user who leaves.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

insert into public.people (id, full_name, slug, claimed_by) values
  ('20000000-0000-0000-0000-000000000001', 'Pepe', 'pepe', '00000000-0000-0000-0000-00000000000b');
insert into public.photos (id, slug, status, proposed_by) values
  ('10000000-0000-0000-0000-000000000001', 'publicada', 'published', '00000000-0000-0000-0000-00000000000b'),
  ('10000000-0000-0000-0000-000000000002', 'propuesta', 'proposed', '00000000-0000-0000-0000-00000000000b');
insert into public.tags (id, photo_id, person_id, x, y, label_number, created_by) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 0.5, 0.5, 1, '00000000-0000-0000-0000-00000000000b');
insert into public.memories (photo_id, author_id, body) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Mi recuerdo');

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

select pg_temp.act_as(null);
select throws_ok($$ select public.delete_own_account() $$, '42501', null,
  'visitors cannot call delete_own_account');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.delete_own_account() $$,
  'There must always be at least one admin', 'the last admin cannot delete their account');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select results_eq(
  $$ select public.delete_own_account() $$,
  $$ values ('10000000-0000-0000-0000-000000000002'::uuid) $$,
  'returns the unpublished photos it deleted'
);
reset role;

select is_empty($$ select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000b' $$,
  'the account is gone');
select is_empty($$ select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000b' $$,
  'and its profile');
select is_empty($$ select 1 from public.memories $$, 'their memories are deleted');
select ok(
  (select claimed_by is null from public.people where id = '20000000-0000-0000-0000-000000000001'),
  'their person is released'
);
select ok(
  (select created_by is null from public.tags where id = '30000000-0000-0000-0000-000000000001'),
  'tags they added stay, without author'
);
select ok(
  (select status = 'published' and proposed_by is null
   from public.photos where id = '10000000-0000-0000-0000-000000000001'),
  'their published photo stays, without contributor'
);
select is_empty($$ select 1 from public.photos where id = '10000000-0000-0000-0000-000000000002' $$,
  'their unpublished proposal is deleted');

select * from finish();
rollback;
