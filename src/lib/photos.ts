// Small helpers shared by the public pages.

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

type Titled = { team: string | null; season_label: string | null };

// There is no title column: a photo is named after its team, or generically.
export function photoTitle(photo: Titled): string {
  return photo.team ?? "Foto sin título";
}

// «Equipo, temporada 1984–85» — used for alt text and link labels.
export function photoLabel(photo: Titled): string {
  const season = photo.season_label ? `, temporada ${photo.season_label}` : "";
  return `${photoTitle(photo)}${season}`;
}

// 1984 -> «Años 80»
export function decadeLabel(year: number | null): string | null {
  if (year === null) return null;
  return `Años ${String(Math.floor(year / 10) * 10).slice(-2)}`;
}
