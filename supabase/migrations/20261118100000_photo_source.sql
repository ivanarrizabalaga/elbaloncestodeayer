-- Where an imported photo came from, to find duplicates later (SPEC §7).
--
-- source_file: path of the file inside the imported folder or export ("CAU/Foto_1.jpg"). Also
--   groups photos that came together (e.g. everything under "PAPA/").
-- image_hash: perceptual hash (64-bit dHash, 16 hex chars) of the image. Unlike a checksum of
--   the bytes, it stays (almost) the same for a screenshot, a resized or a re-encoded copy:
--   two photos are probably the same when their hashes differ in only a few bits.
--
-- Filled in by the local import scripts only; the app never writes them. No new policy: the
-- existing photos policies already cover these columns.

alter table public.photos
  add column source_file text,
  add column image_hash text check (image_hash ~ '^[0-9a-f]{16}$');

create index photos_image_hash_idx on public.photos (image_hash);
