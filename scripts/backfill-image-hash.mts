// Fills photos.image_hash for photos that do not have one yet: everything uploaded or
// imported before the hash existed (e.g. the Instagram import). Run locally, never in the app.
//
//   pnpm backfill:hashes [--dry-run] [--limit N]       (.env.local)
//   pnpm prod:backfill-hashes [--dry-run] [--limit N]  (.env.prod)
//
// - Reads each original from R2 (private bucket), so the hash is the same one the importers
//   compute. Seed photos (storage_key «seed/…») and photos without files are skipped.
// - Idempotent: only photos with image_hash empty; running it again retries the failed ones.
// - At the end it lists the pairs that now look like the same picture (≤ 12 bits apart) and
//   involve a photo hashed in this run, so duplicates across imports show up at once.
// - Uses the Supabase secret key (bypasses RLS) and the R2 keys. Asks before touching a non-local project.

import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { hashDistance, imageHash } from "../src/lib/derivatives.ts";
import { getOriginal } from "../src/lib/r2.ts";
import type { Database } from "../src/lib/supabase/database.types";

// Same threshold as scripts/import-folder.mts.
const LOOKALIKE_BITS = 12;

const { values } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    limit: { type: "string" },
  },
});
const dryRun = values["dry-run"];
const limit = values.limit ? Number.parseInt(values.limit, 10) : Infinity;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  fail(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. See .env.example.",
  );
}
const supabase = createClient<Database>(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Row = {
  id: string;
  slug: string;
  status: string;
  source_file: string | null;
  storage_key: string | null;
  image_hash: string | null;
};

const photos = await allPhotos();
const pending = photos
  .filter((p) => !p.image_hash && p.storage_key?.startsWith("photos/"))
  .slice(0, limit);
const noFiles = photos.filter(
  (p) => !p.image_hash && !p.storage_key?.startsWith("photos/"),
).length;

console.log(
  `Photos: ${photos.length}. With a hash: ${photos.filter((p) => p.image_hash).length}. ` +
    `Without files (seed or missing): ${noFiles}. To hash now: ${pending.length}.`,
);
if (dryRun) {
  console.log("Dry run: nothing was changed.");
  process.exit(0);
}
if (pending.length === 0) process.exit(0);

await confirmTarget(`Hash ${pending.length} photos`);

let done = 0;
let failed = 0;
const hashed = new Set<string>();
for (const photo of pending) {
  try {
    const original = await getOriginal(`${photo.storage_key}/original`);
    const hash = await imageHash(original);
    const { error } = await supabase
      .from("photos")
      .update({ image_hash: hash })
      .eq("id", photo.id)
      .is("image_hash", null);
    if (error) throw new Error(error.message);
    photo.image_hash = hash;
    hashed.add(photo.id);
    done++;
    if (done % 25 === 0) console.log(`[${done + failed}/${pending.length}]`);
  } catch (error) {
    failed++;
    console.error(
      `FAILED ${label(photo)}: ${error instanceof Error ? error.message : error}`,
    );
  }
}
console.log(`Hashed ${done} photos, ${failed} failed.`);

// Pairs that look alike and involve a photo hashed now.
const withHash = photos.filter((p) => p.image_hash && p.status !== "rejected");
const pairs: string[] = [];
for (let i = 0; i < withHash.length; i++) {
  for (let j = i + 1; j < withHash.length; j++) {
    const a = withHash[i];
    const b = withHash[j];
    if (!hashed.has(a.id) && !hashed.has(b.id)) continue;
    const bits = hashDistance(a.image_hash!, b.image_hash!);
    if (bits <= LOOKALIKE_BITS)
      pairs.push(`  ${label(a)} ~ ${label(b)} (${bits})`);
  }
}
if (pairs.length > 0) {
  console.log(`They look like the same picture (${pairs.length} pairs):`);
  for (const line of pairs) console.log(line);
}
process.exit(failed > 0 ? 1 : 0);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function label(photo: Row): string {
  return `${photo.source_file ?? photo.slug} [${photo.status}]`;
}

async function allPhotos(): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("photos")
      .select("id, slug, status, source_file, storage_key, image_hash")
      .order("id")
      .range(from, from + 999);
    if (error) fail(error.message);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function confirmTarget(action: string) {
  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url!);
  if (isLocal) return;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `${action} on ${url}? Type "yes" to continue: `,
  );
  rl.close();
  if (answer.trim() !== "yes") fail("Cancelled.");
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
