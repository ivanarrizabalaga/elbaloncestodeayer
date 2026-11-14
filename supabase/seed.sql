-- Local test data, loaded by `pnpm db:reset`. Never runs in production.
-- Every name, team, venue and story here is made up. Images are placeholder SVGs in public/seed/.

-- ---------------------------------------------------------------------------
-- Accounts (the handle_new_user trigger creates their profiles).
-- Token columns are set to '' because Supabase Auth cannot read NULLs there.
-- To sign in locally, use your own email with `pnpm admin:grant`.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, now(),
  '', '', '', '',
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
from (values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'archivero@example.test'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'pepe@example.test'),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'carlos@example.test')
) as u (id, email);

update public.profiles set role = 'admin', display_name = 'Archivero'
where id = 'a0000000-0000-0000-0000-000000000001';
update public.profiles set display_name = 'Pepe Ferrán'
where id = 'a0000000-0000-0000-0000-000000000002';
update public.profiles set display_name = 'Carlos Alberdi'
where id = 'a0000000-0000-0000-0000-000000000003';

-- ---------------------------------------------------------------------------
-- People. Pepe and Carlos have claimed their profiles.
-- ---------------------------------------------------------------------------

insert into public.people (id, full_name, slug, claimed_by, bio) values
  ('b0000000-0000-0000-0000-000000000001', 'Pepe Ferrán', 'pepe-ferran', 'a0000000-0000-0000-0000-000000000002', 'Base. Jugó en el CB Ribera de 1982 a 1990.'),
  ('b0000000-0000-0000-0000-000000000002', 'Luis Menaya', 'luis-menaya', null, null),
  ('b0000000-0000-0000-0000-000000000003', 'Carlos Alberdi', 'carlos-alberdi', 'a0000000-0000-0000-0000-000000000003', null),
  ('b0000000-0000-0000-0000-000000000004', 'Andrés Solana', 'andres-solana', null, null),
  ('b0000000-0000-0000-0000-000000000005', 'Manuel Garrido', 'manuel-garrido', null, null),
  ('b0000000-0000-0000-0000-000000000006', 'Toño Robledo', 'tono-robledo', null, null),
  ('b0000000-0000-0000-0000-000000000007', 'Roberto Dorado', 'roberto-dorado', null, null),
  ('b0000000-0000-0000-0000-000000000008', 'Javier Olmedo', 'javier-olmedo', null, null),
  ('b0000000-0000-0000-0000-000000000009', 'Íñigo Larrea', 'inigo-larrea', null, null),
  ('b0000000-0000-0000-0000-000000000010', 'Fernando Quirós', 'fernando-quiros', null, 'Entrenador del CB Ribera en los ochenta.'),
  ('b0000000-0000-0000-0000-000000000011', 'Miguel Ángel Sastre', 'miguel-angel-sastre', null, null),
  ('b0000000-0000-0000-0000-000000000012', 'Ramón Vidal', 'ramon-vidal', null, null);

-- A duplicate already merged into Pepe: /persona/pepe-ferran-2 redirects to /persona/pepe-ferran.
insert into public.people (id, full_name, slug, merged_into) values
  ('b0000000-0000-0000-0000-000000000013', 'Pepe Ferran', 'pepe-ferran-2', 'b0000000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- Photos: 8 published across three decades, 1 draft (only admins see it).
-- ---------------------------------------------------------------------------

insert into public.photos (
  id, slug, status, season_label, year_from, year_to, team, venue, competition,
  provenance, photographer, story, featured, storage_key, width, height,
  published_by, published_at
) values
  ('c0000000-0000-0000-0000-000000000001', 'cb-ribera-1984-85-equipo', 'published', '1984–85', 1984, 1985,
   'CB Ribera', 'Pabellón Municipal de la Ribera', 'Liga provincial', 'Colección del archivero', null,
   'Foto de equipo antes de la final provincial. Aquella temporada el CB Ribera solo perdió dos partidos y la final se jugó con el pabellón lleno hasta las escaleras.',
   true, 'seed/team-1.svg', 1200, 800, 'a0000000-0000-0000-0000-000000000001', now() - interval '20 days'),
  ('c0000000-0000-0000-0000-000000000002', 'cb-ribera-1984-85-entrada', 'published', '1984–85', 1984, 1985,
   'CB Ribera', 'Pabellón Municipal de la Ribera', 'Liga provincial', 'Colección del archivero', 'Foto Estudio Sol',
   'Entrada a canasta en el partido de ida contra el Atlético Norte.',
   false, 'seed/action-1.svg', 800, 1000, 'a0000000-0000-0000-0000-000000000001', now() - interval '18 days'),
  ('c0000000-0000-0000-0000-000000000003', 'cb-ribera-1984-85-banquillo', 'published', '1984–85', 1984, 1985,
   'CB Ribera', 'Polideportivo San Isidro', 'Torneo de Navidad', 'Colección del archivero', null,
   null,
   false, 'seed/group-1.svg', 1200, 900, 'a0000000-0000-0000-0000-000000000001', now() - interval '16 days'),
  ('c0000000-0000-0000-0000-000000000004', 'cb-ribera-1985-86-equipo', 'published', '1985–86', 1985, 1986,
   'CB Ribera', 'Pabellón Municipal de la Ribera', 'Liga provincial', 'Colección del archivero', null,
   'Primera temporada con equipación nueva.',
   false, 'seed/team-2.svg', 1200, 800, 'a0000000-0000-0000-0000-000000000001', now() - interval '14 days'),
  ('c0000000-0000-0000-0000-000000000005', 'atletico-norte-1978-79-equipo', 'published', '1978–79', 1978, 1979,
   'Atlético Norte', 'Frontón Viejo', 'Juegos escolares', 'Aportada por un antiguo jugador', null,
   'Cuando todavía se jugaba al aire libre, en el frontón.',
   false, 'seed/team-3.svg', 1200, 800, 'a0000000-0000-0000-0000-000000000001', now() - interval '12 days'),
  ('c0000000-0000-0000-0000-000000000006', 'atletico-norte-1979-80-tapon', 'published', '1979–80', 1979, 1980,
   'Atlético Norte', 'Frontón Viejo', 'Juegos escolares', 'Aportada por un antiguo jugador', null,
   null,
   false, 'seed/action-2.svg', 800, 1000, 'a0000000-0000-0000-0000-000000000001', now() - interval '10 days'),
  ('c0000000-0000-0000-0000-000000000007', 'veteranos-ribera-1993-94', 'published', '1993–94', 1993, 1994,
   'Veteranos Ribera', 'Pabellón Municipal de la Ribera', 'Liga de veteranos', 'Colección del archivero', null,
   'Reencuentro de la generación del 84, ya como veteranos.',
   false, 'seed/group-1.svg', 1200, 900, 'a0000000-0000-0000-0000-000000000001', now() - interval '8 days'),
  ('c0000000-0000-0000-0000-000000000008', 'cb-ribera-1989-90-equipo', 'published', '1989–90', 1989, 1990,
   'CB Ribera', 'Pabellón Municipal de la Ribera', 'Segunda División', 'Colección del archivero', null,
   null,
   false, 'seed/team-1.svg', 1200, 800, 'a0000000-0000-0000-0000-000000000001', now() - interval '6 days'),
  ('c0000000-0000-0000-0000-000000000009', 'borrador-sin-publicar', 'draft', '1986–87', 1986, 1987,
   'CB Ribera', null, null, 'Colección del archivero', null,
   'Borrador: no debe verse en la web pública.',
   false, 'seed/team-2.svg', 1200, 800, null, null);

-- ---------------------------------------------------------------------------
-- Tags. Positions match the faces in the placeholder SVGs:
-- team photos: 5 standing (y 0.325) and 6 kneeling (y 0.5875); null person = «?».
-- ---------------------------------------------------------------------------

insert into public.tags (photo_id, person_id, x, y, label_number, created_by) values
  -- CB Ribera 1984–85, team photo
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 0.20, 0.325, 1, 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 0.35, 0.325, 2, 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 0.50, 0.325, 3, 'a0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000001', null,                                   0.65, 0.325, 4, 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 0.80, 0.325, 5, 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000005', 0.125, 0.5875, 6, 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000006', 0.275, 0.5875, 7, 'a0000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000001', null,                                   0.425, 0.5875, 8, 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000007', 0.575, 0.5875, 9, 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000010', 0.725, 0.5875, 10, 'a0000000-0000-0000-0000-000000000001'),
  -- CB Ribera 1984–85, drive to the basket
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 0.375, 0.38, 1, 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', null,                                   0.5875, 0.47, 2, 'a0000000-0000-0000-0000-000000000001'),
  -- CB Ribera 1984–85, bench
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000010', 0.25, 0.3667, 1, 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 0.4167, 0.3667, 2, 'a0000000-0000-0000-0000-000000000001'),
  -- CB Ribera 1985–86, team photo
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 0.20, 0.325, 1, 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', 0.35, 0.325, 2, 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000008', 0.50, 0.325, 3, 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000004', null,                                   0.125, 0.5875, 4, 'a0000000-0000-0000-0000-000000000001'),
  -- Atlético Norte 1978–79, team photo
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000009', 0.20, 0.325, 1, 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000011', 0.35, 0.325, 2, 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000005', null,                                   0.50, 0.325, 3, 'a0000000-0000-0000-0000-000000000001'),
  -- Veteranos Ribera 1993–94
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 0.25, 0.3667, 1, 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000002', 0.4167, 0.3667, 2, 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000006', 0.5833, 0.3667, 3, 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000012', 0.75, 0.3667, 4, 'a0000000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- Memories. The last one is hidden by moderation (must not be shown).
-- ---------------------------------------------------------------------------

insert into public.memories (photo_id, author_id, body, hidden_at, created_at) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003',
   'Me acuerdo de que esa mañana llovía y casi no llegamos al pabellón. Al final ganamos de seis.', null, now() - interval '5 days'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
   'La camiseta me quedaba enorme: era la de mi hermano.', null, now() - interval '3 days'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
   'Recuerdo oculto por moderación.', now(), now() - interval '2 days');

-- ---------------------------------------------------------------------------
-- A pending invitation for Luis (tag 2 of the 1984–85 team photo), to try the flow locally:
-- http://localhost:3000/invitacion/prueba-luis  (local only: the token is public in this repo).
-- ---------------------------------------------------------------------------

insert into public.invitations (token_hash, role, person_id, tag_id, invited_by)
select public.invitation_token_hash('prueba-luis'), 'user', t.person_id, t.id,
       'a0000000-0000-0000-0000-000000000001'
from public.tags t
where t.photo_id = 'c0000000-0000-0000-0000-000000000001' and t.label_number = 2;
