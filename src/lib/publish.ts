import "server-only";
import { slugify, uniqueSlug } from "@/lib/slug";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

// Fields that publish a draft or a proposal for the first time: its final slug (from teams
// and season, «cb-ribera-1984-85» or «cb-ribera-estudiantes-1984-85», numbered if taken) and who published it, when.
// Shared by the photo form and the bulk action on /admin/subir.
export async function firstPublishFields(
  supabase: Client,
  photo: {
    team: string | null;
    team_2?: string | null;
    season_label: string | null;
  },
  adminId: string,
) {
  const base = slugify(
    [photo.team, photo.team_2, photo.season_label].filter(Boolean).join(" ") ||
      "foto",
  );
  const { data: similar } = await supabase
    .from("photos")
    .select("slug")
    .like("slug", `${base}%`);
  return {
    status: "published" as const,
    slug: uniqueSlug(
      base,
      (similar ?? []).map((p) => p.slug),
    ),
    published_at: new Date().toISOString(),
    published_by: adminId,
  };
}
