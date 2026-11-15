// Imports a folder of photos (e.g. a Google Drive download) as draft photos (SPEC §7).
// Run locally, never in the app.
//
//   pnpm import:folder <dir> --map <map.json> [--dry-run] [--limit N]       (.env.local)
//   pnpm prod:import-folder <dir> --map <map.json> [--dry-run] [--limit N]  (.env.prod)
//
// <dir> and <map.json> hold real content and names: keep both outside the repo.
//
// - One draft per image (jpg, png, webp, heic). Videos and other files are skipped.
// - HEIC files are converted to JPEG with macOS `sips` (sharp cannot read them).
// - The map pre-fills team, venue, competition, season, provenance and story, and can turn
//   an image scanned sideways (rotate); see MapEntry. Values merge: map defaults < folder < file.
// - Each photo keeps its path in the folder (source_file) and a perceptual hash (image_hash),
//   so duplicates can be found later, even against screenshots or other imports.
// - Idempotent: the id is derived from the file's bytes, so running it again skips what was
//   already imported, and identical files (even with another name) are imported once.
// - Uses the Supabase secret key (bypasses RLS) and the R2 keys. Asks before touching a non-local project.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import {
  hashDistance,
  imageHash,
  makeDerivatives,
  photoKeys,
} from "../src/lib/derivatives.ts";
import { parseSeason } from "../src/lib/photos.ts";
import { putOriginal, putPublic } from "../src/lib/r2.ts";
import type { Database } from "../src/lib/supabase/database.types";

const IMAGE_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic", // converted to image/jpeg before upload
};

// Hash distance under which two images are reported as probably the same. Measured on the
// first Drive folder: a scan and a phone photo of the same print differ in 3–12 bits;
// different photos, 13 or more. Crops and reframed copies are not caught.
const LOOKALIKE_BITS = 12;

const FIELDS = [
  "team",
  "venue",
  "competition",
  "season",
  "provenance",
  "story",
  "rotate",
] as const;

// Anything not set stays empty, for an admin to fill in.
type MapEntry = {
  team?: string;
  venue?: string;
  competition?: string;
  season?: string; // free text: «1984–85», «1979», «Años 70»
  provenance?: string;
  story?: string;
  rotate?: 90 | 180 | 270; // clockwise degrees, for images scanned sideways
};

type ImportMap = MapEntry & {
  skip?: string[]; // folders or files (paths relative to <dir>) not to import
  folders?: Record<string, MapEntry>; // keyed by top-level folder name
  files?: Record<string, MapEntry>; // keyed by path relative to <dir>
};

type Candidate = {
  id: string;
  path: string; // relative to <dir>, with trimmed folder names
  file: string; // absolute
  meta: MapEntry;
};

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    map: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    limit: { type: "string" },
  },
});

const dir = positionals[0];
if (!dir || !values.map) {
  fail(
    "Usage: import-folder.mts <dir> --map <map.json> [--dry-run] [--limit N]",
  );
}
const dryRun = values["dry-run"];
const limit = values.limit ? Number.parseInt(values.limit, 10) : Infinity;
const map: ImportMap = JSON.parse(await readFile(values.map, "utf8"));

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

// ---------------------------------------------------------------------------
// Read the folder
// ---------------------------------------------------------------------------

const skip = (map.skip ?? []).map(normalise);
const candidates: Candidate[] = [];
const sameBytes: string[] = [];
let skipped = 0;
const entries = (await readdir(dir, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => join(entry.parentPath, entry.name))
  // «Foto.jpg» before its copy «Foto(1).jpg», so identical copies keep the original name.
  .sort((a, b) => {
    const copy = /\(\d+\)(?=\.[^.]+$)/;
    const order = a.replace(copy, "").localeCompare(b.replace(copy, ""));
    return order || a.length - b.length;
  });
for (const file of entries) {
  const path = normalise(file.slice(dir.length).replace(/^\/+/, ""));
  if (!IMAGE_TYPES[extname(path).toLowerCase()]) continue;
  if (skip.some((s) => path === s || path.startsWith(`${s}/`))) {
    skipped++;
    continue;
  }
  const id = idFor(await readFile(file));
  const twin = candidates.find((c) => c.id === id);
  if (twin) {
    sameBytes.push(`${path} = ${twin.path}`);
    continue;
  }
  const folder = path.includes("/") ? path.slice(0, path.indexOf("/")) : "";
  candidates.push({
    id,
    path,
    file,
    meta: {
      ...pick(map, "map"),
      ...pick(map.folders?.[folder], folder),
      ...pick(map.files?.[path], path),
    },
  });
}

const unknownKeys = [
  ...Object.keys(map.folders ?? {}).filter(
    (f) => !candidates.some((c) => c.path.startsWith(`${f}/`)),
  ),
  ...Object.keys(map.files ?? {}).filter(
    (f) => !candidates.some((c) => c.path === f),
  ),
];
if (unknownKeys.length > 0) {
  console.warn(`Map entries that match no image: ${unknownKeys.join(", ")}`);
}

const existing = await existingIds(candidates.map((c) => c.id));
const pending = candidates.filter((c) => !existing.has(c.id)).slice(0, limit);

console.log(
  `Folder: ${candidates.length} images (${skipped} skipped by the map, ${sameBytes.length} identical copies).`,
);
for (const line of sameBytes) console.log(`  identical: ${line}`);
console.log(
  `Already imported: ${existing.size}. To import now: ${pending.length}.`,
);

if (dryRun) {
  const byFolder = new Map<string, Candidate[]>();
  for (const c of pending) {
    const folder = c.path.split("/")[0];
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), c]);
  }
  for (const [folder, list] of byFolder) {
    const withSeason = list.filter((c) => c.meta.season).length;
    const withVenue = list.filter((c) => c.meta.venue).length;
    console.log(
      `- ${folder}: ${list.length} · team: ${list[0].meta.team ?? "—"} · season: ${withSeason} · venue: ${withVenue}`,
    );
  }
  console.log("Dry run: nothing was uploaded or created.");
  process.exit(0);
}
if (pending.length === 0) process.exit(0);

await confirmTarget(`Import ${pending.length} drafts`);

// ---------------------------------------------------------------------------
// Import, one image at a time
// ---------------------------------------------------------------------------

const knownHashes = await existingHashes();
const work = await mkdtemp(join(tmpdir(), "import-folder-"));
let done = 0;
let failed = 0;
const lookalikes: string[] = [];
for (const c of pending) {
  try {
    const { original, contentType } = await readOriginal(
      c.file,
      work,
      c.meta.rotate,
    );
    const keys = photoKeys(c.id);
    const { large, thumb, width, height } = await makeDerivatives(original);
    const hash = await imageHash(original);
    const twin = knownHashes.find(
      (k) => hashDistance(k.hash, hash) <= LOOKALIKE_BITS,
    );
    if (twin) lookalikes.push(`${c.path} ~ ${twin.label}`);

    await putOriginal(keys.original, original, contentType);
    await putPublic(keys.large, large, "image/webp");
    await putPublic(keys.thumb, thumb, "image/webp");

    const { yearFrom, yearTo } = parseSeason(c.meta.season ?? "");
    const { error } = await supabase.from("photos").insert({
      id: c.id,
      slug: `borrador-${c.id.slice(0, 8)}`,
      status: "draft",
      storage_key: keys.storageKey,
      width,
      height,
      team: c.meta.team ?? null,
      venue: c.meta.venue ?? null,
      competition: c.meta.competition ?? null,
      season_label: c.meta.season ?? null,
      year_from: yearFrom,
      year_to: yearTo,
      provenance: c.meta.provenance ?? null,
      story: c.meta.story ?? null,
      source_file: c.path,
      image_hash: hash,
    });
    if (error) throw new Error(error.message);
    knownHashes.push({ hash, label: c.path });
    done++;
    console.log(`[${done + failed}/${pending.length}] ok ${c.path}`);
  } catch (error) {
    failed++;
    console.error(
      `[${done + failed}/${pending.length}] FAILED ${c.path}: ${error instanceof Error ? error.message : error}`,
    );
  }
}
await rm(work, { recursive: true, force: true });
if (lookalikes.length > 0) {
  console.log(
    `Imported anyway, but they look like a photo already there (review them in the admin):`,
  );
  for (const line of lookalikes) console.log(`  ${line}`);
}
console.log(
  `Imported ${done} drafts, ${failed} failed. Running it again retries the failed ones.`,
);
process.exit(failed > 0 ? 1 : 0);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Only the MapEntry fields; anything else in a folder or file entry is probably a typo.
function pick(entry: object | undefined, where: string): MapEntry {
  if (!entry) return {};
  const picked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if ((FIELDS as readonly string[]).includes(key)) picked[key] = value;
    else if (where !== "map")
      fail(`Unknown field «${key}» in the map entry for ${where}.`);
  }
  if (
    picked.rotate !== undefined &&
    ![90, 180, 270].includes(picked.rotate as number)
  ) {
    fail(`rotate must be 90, 180 or 270 in the map entry for ${where}.`);
  }
  return picked as MapEntry;
}

// Trims each segment: Drive folder names may end in a space («GIJON BALONCESTO »).
function normalise(path: string): string {
  return path
    .split("/")
    .map((segment) => segment.trim())
    .join("/");
}

// Stable UUID from the file's bytes (so re-runs and identical copies are skipped).
function idFor(bytes: Buffer): string {
  const hex = createHash("sha256")
    .update("folder:")
    .update(bytes)
    .digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

// HEIC is converted to JPEG (sharp cannot read it); a rotated image is stored rotated, as JPEG.
async function readOriginal(
  file: string,
  work: string,
  rotate: MapEntry["rotate"],
): Promise<{ original: Buffer; contentType: string }> {
  let contentType = IMAGE_TYPES[extname(file).toLowerCase()];
  let original: Buffer;
  if (contentType === "image/heic") {
    const out = join(work, "converted.jpg");
    execFileSync("sips", ["-s", "format", "jpeg", file, "--out", out], {
      stdio: "ignore",
    });
    original = await readFile(out);
    contentType = "image/jpeg";
  } else {
    original = await readFile(file);
  }
  if (rotate) {
    original = await sharp(original)
      .rotate()
      .rotate(rotate)
      .jpeg({ quality: 92 })
      .toBuffer();
    contentType = "image/jpeg";
  }
  return { original, contentType };
}

async function existingIds(ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from("photos")
      .select("id")
      .in("id", ids.slice(i, i + 200));
    if (error) fail(error.message);
    for (const row of data) found.add(row.id);
  }
  return found;
}

async function existingHashes(): Promise<{ hash: string; label: string }[]> {
  const found: { hash: string; label: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("photos")
      .select("slug, source_file, image_hash")
      .not("image_hash", "is", null)
      .range(from, from + 999);
    if (error) fail(error.message);
    for (const row of data) {
      found.push({ hash: row.image_hash!, label: row.source_file ?? row.slug });
    }
    if (data.length < 1000) return found;
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
