-- Details of one's own proposal. Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

truncate public.photos, public.people, auth.users cascade;

-- a = admin, b = proposer, c = another user, d = blocked proposer.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'd@example.test', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set blocked_at = now() where id = '00000000-0000-0000-0000-00000000000d';

insert into public.photos (id, slug, status, proposed_by, storage_key, width, height) values
  ('10000000-0000-0000-0000-000000000001', 'propuesta-1', 'proposed',
   '00000000-0000-0000-0000-00000000000b', 'seed/team-1.svg', 1200, 800),
  ('10000000-0000-0000-0000-000000000002', 'publicada', 'published',
   '00000000-0000-0000-0000-00000000000b', 'seed/team-1.svg', 1200, 800),
  ('10000000-0000-0000-0000-000000000003', 'propuesta-d', 'proposed',
   '00000000-0000-0000-0000-00000000000d', 'seed/team-1.svg', 1200, 800);

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

create function pg_temp.edit(p_photo uuid) returns void language sql as $$
  select public.update_own_proposal(
    p_photo, '1984–85', 'CB Inventado', 'Pabellón Inventado', 'Liga',
    'Álbum de casa', 'Un vecino', '  La final.  ', 1984, 1985
  );
$$;

select pg_temp.act_as(null);
select throws_ok($$ select pg_temp.edit('10000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'visitors cannot edit proposals');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok($$ select pg_temp.edit('10000000-0000-0000-0000-000000000001') $$,
  'not_allowed', 'another user cannot edit it');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok($$ select pg_temp.edit('10000000-0000-0000-0000-000000000001') $$,
  'the proposer fills in the details');
select throws_ok($$ select pg_temp.edit('10000000-0000-0000-0000-000000000002') $$,
  'not_allowed', 'not once it is published');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select throws_ok($$ select pg_temp.edit('10000000-0000-0000-0000-000000000003') $$,
  'not_allowed', 'not from a blocked account');

reset role;
select ok(
  (select team = 'CB Inventado' and year_from = 1984 and year_to = 1985 and story = 'La final.'
     and status = 'proposed'
   from public.photos where id = '10000000-0000-0000-0000-000000000001'),
  'the details are saved, trimmed, and the photo stays proposed'
);
select is(
  (select team from public.photos where id = '10000000-0000-0000-0000-000000000002'),
  null, 'the published photo is untouched'
);

select * from finish();
rollback;
