// Small helpers shared by the public pages.

import type { Database } from "@/lib/supabase/database.types";

type PhotoStatus = Database["public"]["Enums"]["photo_status"];

export type ImageSize = "thumb" | "large";

// storage_key "photos/<id>": derivatives at <NEXT_PUBLIC_IMAGES_URL>/photos/<id>/{thumb,large}.webp
// (thumb ~480 px wide, large ~1600 px, generated on upload).
// storage_key "seed/…": local placeholder files in public/ (test data only).
export function photoSrc(
  storageKey: string,
  size: ImageSize = "large",
): string {
  if (storageKey.startsWith("seed/")) return `/${storageKey}`;
  // NEXT_PUBLIC_* must be referenced literally so Next.js can inline it.
  const base = process.env.NEXT_PUBLIC_IMAGES_URL;
  if (!base) {
    throw new Error(
      "Missing environment variable NEXT_PUBLIC_IMAGES_URL. See .env.example.",
    );
  }
  return `${base}/${storageKey}/${size}.webp`;
}

export const PHOTO_STATUS_LABEL: Record<PhotoStatus, string> = {
  draft: "Borrador",
  proposed: "Propuesta",
  published: "Publicada",
  withdrawn: "Retirada",
  rejected: "Rechazada",
};

type Titled = {
  team: string | null;
  team_2?: string | null;
  season_label: string | null;
};

// «CB Ribera – Estudiantes»: the teams of a photo (one or two), or null.
export function teamsText(photo: {
  team: string | null;
  team_2?: string | null;
}): string | null {
  return [photo.team, photo.team_2].filter(Boolean).join(" – ") || null;
}

// There is no title column: a photo is named after its teams, or generically.
export function photoTitle(photo: Titled): string {
  return teamsText(photo) ?? "Foto sin título";
}

// «1984–85» -> «temporada 1984–85»; a decade-only label («Años 70») -> «años 70».
export function seasonText(label: string): string {
  return /^a[ñn]os\b/i.test(label) ? label.toLowerCase() : `temporada ${label}`;
}

// «Equipo, temporada 1984–85» — used for alt text and link labels.
export function photoLabel(photo: Titled): string {
  const season = photo.season_label
    ? `, ${seasonText(photo.season_label)}`
    : "";
  return `${photoTitle(photo)}${season}`;
}

// 1984 -> «Años 80»
export function decadeLabel(year: number | null): string | null {
  if (year === null) return null;
  return `Años ${String(Math.floor(year / 10) * 10).slice(-2)}`;
}

// «1984–85» -> 1984/1985, «1979» -> 1979/1979, «Navidad de 1983» -> 1983/1983,
// «Años 70» -> 1970/1979 (when only the decade is known; «Años 2000» is read as the year 2000).
// The free-text label is what people see; the years drive the decade filter.
export function parseSeason(label: string): {
  yearFrom: number | null;
  yearTo: number | null;
} {
  const match = label.match(
    /(1[89]\d{2}|20\d{2})(?:\s*[-–\/]\s*(\d{4}|\d{2}))?/,
  );
  if (!match) {
    const decade = label.match(/a[ñn]os\s+(\d0)\b/i);
    if (!decade) return { yearFrom: null, yearTo: null };
    const from = 1900 + Number(decade[1]);
    return { yearFrom: from, yearTo: from + 9 };
  }
  const from = Number(match[1]);
  if (!match[2]) return { yearFrom: from, yearTo: from };
  let to = Number(match[2]);
  if (match[2].length === 2) to = Math.floor(from / 100) * 100 + to;
  if (to < from) to += 100; // 1999–00
  return { yearFrom: from, yearTo: to };
}
