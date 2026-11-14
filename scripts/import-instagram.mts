// Imports an Instagram account export as draft photos (SPEC §7). Run locally, never in the app.
//
//   pnpm import:instagram <export-dir> [--dry-run] [--limit N] [--provenance "…"]       (.env.local)
//   pnpm prod:import-instagram <export-dir> [--dry-run] [--limit N] [--provenance "…"]  (.env.prod)
//
// <export-dir> is the unzipped "Download your information" export in JSON format. Keep it in
// instagram-export/ (gitignored): it must never be committed.
//
// - One draft per image (carousel posts give one draft per image, sharing the caption). Videos are skipped.
// - The caption becomes the story; a season or year found in it pre-fills the season.
// - Idempotent: each image gets an id derived from its path in the export, so running it again
//   skips what was already imported.
// - Uses the Supabase secret key (bypasses RLS) and the R2 keys. Asks before touching a non-local project.

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { makeDerivatives, photoKeys } from "../src/lib/derivatives.ts";
import { parseSeason } from "../src/lib/photos.ts";
import { putOriginal, putPublic } from "../src/lib/r2.ts";
import type { Database } from "../src/lib/supabase/database.types";

const IMAGE_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

type ExportMedia = {
  uri?: string;
  creation_timestamp?: number;
  title?: string;
};
type ExportPost = {
  media?: ExportMedia[];
  title?: string;
  creation_timestamp?: number;
};

type Candidate = {
  id: string;
  file: string;
  contentType: string;
  caption: string;
  takenAt: Date | null;
  position: string; // «2/3» inside a carousel, "" otherwise
};

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "dry-run": { type: "boolean", default: false },
    limit: { type: "string" },
    provenance: { type: "string" },
  },
});

const exportDir = positionals[0];
if (!exportDir) {
  fail(
    'Usage: import-instagram.mts <export-dir> [--dry-run] [--limit N] [--provenance "…"]',
  );
}
const dryRun = values["dry-run"];
const limit = values.limit ? Number.parseInt(values.limit, 10) : Infinity;
const provenance = values.provenance?.trim() || null;

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
// Read the export
// ---------------------------------------------------------------------------

const postFiles = await findPostFiles(exportDir);
if (postFiles.length === 0) {
  fail(
    `No posts_*.json found under ${exportDir}. Was the export requested in JSON format?`,
  );
}

const candidates: Candidate[] = [];
let videos = 0;
let posts = 0;
for (const file of postFiles) {
  const data: ExportPost[] = JSON.parse(await readFile(file, "utf8"));
  for (const post of data) {
    posts++;
    const media = post.media ?? [];
    const caption = cleanCaption(fixText(post.title || media[0]?.title || ""));
    media.forEach((item, index) => {
      if (!item.uri) return;
      const contentType = IMAGE_TYPES[extname(item.uri).toLowerCase()];
      if (!contentType) {
        videos++;
        return;
      }
      const timestamp = item.creation_timestamp ?? post.creation_timestamp;
      candidates.push({
        id: idFor(item.uri),
        file: join(exportDir, item.uri),
        contentType,
        caption,
        takenAt: timestamp ? new Date(timestamp * 1000) : null,
        position: media.length > 1 ? `${index + 1}/${media.length}` : "",
      });
    });
  }
}

// Oldest first, so drafts follow the order they were posted in.
candidates.sort(
  (a, b) => (a.takenAt?.getTime() ?? 0) - (b.takenAt?.getTime() ?? 0),
);

const existing = await existingIds(candidates.map((c) => c.id));
const pending = candidates.filter((c) => !existing.has(c.id)).slice(0, limit);

console.log(
  `Export: ${posts} posts, ${candidates.length} images, ${videos} videos skipped.`,
);
console.log(
  `Already imported: ${existing.size}. To import now: ${pending.length}.`,
);
const withSeason = pending.filter((c) => seasonFromCaption(c.caption)).length;
console.log(
  `Season or year found in the caption: ${withSeason} of ${pending.length}.`,
);

if (dryRun) {
  for (const c of pending.slice(0, 10)) {
    console.log(
      `- ${c.takenAt?.toISOString().slice(0, 10) ?? "????-??-??"} ${c.position.padEnd(5)} season: ${seasonFromCaption(c.caption) ?? "—"} · ${c.caption.slice(0, 70).replace(/\s+/g, " ")}`,
    );
  }
  if (pending.length > 10) console.log(`  … and ${pending.length - 10} more.`);
  console.log("Dry run: nothing was uploaded or created.");
  process.exit(0);
}
if (pending.length === 0) process.exit(0);

await confirmTarget(`Import ${pending.length} drafts`);

// ---------------------------------------------------------------------------
// Import, one image at a time
// ---------------------------------------------------------------------------

let done = 0;
let failed = 0;
for (const c of pending) {
  try {
    const original = await readFile(c.file);
    const keys = photoKeys(c.id);
    const { large, thumb, width, height } = await makeDerivatives(original);
    await putOriginal(keys.original, original, c.contentType);
    await putPublic(keys.large, large, "image/webp");
    await putPublic(keys.thumb, thumb, "image/webp");

    const season = seasonFromCaption(c.caption);
    const { yearFrom, yearTo } = parseSeason(season ?? "");
    const { error } = await supabase.from("photos").insert({
      id: c.id,
      slug: `borrador-${c.id.slice(0, 8)}`,
      status: "draft",
      storage_key: keys.storageKey,
      width,
      height,
      story: c.caption || null,
      season_label: season,
      year_from: yearFrom,
      year_to: yearTo,
      provenance,
      created_at: c.takenAt?.toISOString(),
    });
    if (error) throw new Error(error.message);
    done++;
    console.log(`[${done + failed}/${pending.length}] ok ${c.file}`);
  } catch (error) {
    failed++;
    console.error(
      `[${done + failed}/${pending.length}] FAILED ${c.file}: ${error instanceof Error ? error.message : error}`,
    );
  }
}
console.log(
  `Imported ${done} drafts, ${failed} failed. Running it again retries the failed ones.`,
);
process.exit(failed > 0 ? 1 : 0);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findPostFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true });
  return entries
    .filter((entry) => /(^|\/)posts_\d+\.json$/.test(entry))
    .sort()
    .map((entry) => join(dir, entry));
}

// Instagram writes UTF-8 text as one \u00XX escape per byte («Ã±» instead of «ñ»).
function fixText(text: string): string {
  if ([...text].some((ch) => ch.charCodeAt(0) > 0xff)) return text;
  const fixed = Buffer.from(text, "latin1").toString("utf8");
  return fixed.includes("�") ? text : fixed;
}

// Drops lines that are only hashtags or mentions; the story keeps the actual text.
function cleanCaption(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^\s*([#@][\p{L}\p{N}_.]+\s*)+$/u.test(line))
    .join("\n")
    .trim();
}

// «1984-85», «1984/85», «84-85»? (no: too ambiguous) or a lone year → a season label.
function seasonFromCaption(caption: string): string | null {
  const season = caption.match(
    /\b(19[0-9]{2}|20[0-2][0-9])\s*[-–/]\s*(\d{4}|\d{2})\b/,
  );
  if (season) {
    const to = season[2].length === 4 ? season[2].slice(-2) : season[2];
    return `${season[1]}–${to}`;
  }
  const year = caption.match(/\b(19[0-9]{2}|20[0-2][0-9])\b/);
  return year ? year[1] : null;
}

// Stable UUID from the image's path in the export (so re-runs skip it).
function idFor(uri: string): string {
  const hex = createHash("sha256").update(`instagram:${uri}`).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
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
