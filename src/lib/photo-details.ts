import { parseSeason } from "@/lib/photos";
import type { createClient } from "@/lib/supabase/server";

// The descriptive details of a photo, shared by the admin form, the proposer's form and the
// «datos comunes» of a batch upload. Instagram and «foto de la semana» are admin-only and
// stay out of here.

export type PhotoDetails = {
  season_label: string | null;
  year_from: number | null;
  year_to: number | null;
  team: string | null;
  team_2: string | null;
  venue: string | null;
  competition: string | null;
  provenance: string | null;
  photographer: string | null;
  story: string | null;
};

// Reads the fields by name (FormData or a plain object), trimmed, empty → null.
export function readPhotoDetails(get: (name: string) => unknown): PhotoDetails {
  const text = (name: string, max: number) => {
    const value = String(get(name) ?? "")
      .trim()
      .slice(0, max);
    return value === "" ? null : value;
  };
  const seasonLabel = text("season_label", 100);
  const { yearFrom, yearTo } = parseSeason(seasonLabel ?? "");
  // A lone second team moves up to the first; the same team twice counts once.
  const [team = null, team2 = null] = [
    ...new Set([text("team", 200), text("team_2", 200)].filter(Boolean)),
  ] as string[];
  return {
    season_label: seasonLabel,
    year_from: yearFrom,
    year_to: yearTo,
    team,
    team_2: team2,
    venue: text("venue", 200),
    competition: text("competition", 200),
    provenance: text("provenance", 200),
    photographer: text("photographer", 200),
    story: text("story", 4000),
  };
}

export type DetailSuggestions = Record<
  "team" | "venue" | "competition" | "provenance",
  string[]
>;

// Existing values, offered as suggestions so the same team is not spelt five ways. Runs
// through RLS: admins get every photo, users the published ones and their own.
export async function loadDetailSuggestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<DetailSuggestions> {
  const { data } = await supabase
    .from("photos")
    .select("team, team_2, venue, competition, provenance");
  const values = (...keys: (keyof DetailSuggestions | "team_2")[]) =>
    [
      ...new Set(
        (data ?? []).flatMap((v) => keys.flatMap((k) => (v[k] ? [v[k]] : []))),
      ),
    ].sort((a, b) => a.localeCompare(b, "es"));
  return {
    // Both team fields share one list.
    team: values("team", "team_2"),
    venue: values("venue"),
    competition: values("competition"),
    provenance: values("provenance"),
  };
}
