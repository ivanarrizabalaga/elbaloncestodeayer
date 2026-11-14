// Small helpers shared by the public pages.

// Phase 2 serves placeholder images from public/ (storage_key "seed/…").
// Phase 3 points this at the R2 public domain and the generated derivatives.
export function photoSrc(storageKey: string): string {
  return `/${storageKey}`;
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
