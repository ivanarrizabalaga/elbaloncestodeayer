import "server-only";
import { photoLabel, teamsText } from "@/lib/photos";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type Lookalike = {
  id: string;
  // «CAU/Foto_1.jpg (borrador)»: where it came from, or its team, and its status.
  label: string;
  storage_key: string | null;
};

const STATUS: Record<string, string> = {
  draft: "borrador",
  published: "publicada",
  proposed: "propuesta",
  withdrawn: "retirada",
};

// Other photos that look like each of the given ones (same picture, by image_hash; see the
// photo_lookalikes function). Runs as the signed-in admin, through RLS.
export async function loadLookalikes(
  supabase: Client,
  photoIds: string[],
): Promise<Map<string, Lookalike[]>> {
  const result = new Map<string, Lookalike[]>();
  if (photoIds.length === 0) return result;
  const { data: pairs } = await supabase.rpc("photo_lookalikes", {
    photo_ids: photoIds,
  });
  if (!pairs?.length) return result;
  const { data: others } = await supabase
    .from("photos")
    .select("id, team, team_2, source_file, storage_key")
    .in("id", [...new Set(pairs.map((p) => p.other_id))]);
  const byId = new Map((others ?? []).map((o) => [o.id, o]));
  for (const pair of pairs) {
    const other = byId.get(pair.other_id);
    const status = STATUS[pair.other_status] ?? pair.other_status;
    result.set(pair.photo_id, [
      ...(result.get(pair.photo_id) ?? []),
      {
        id: pair.other_id,
        label: `${other?.source_file ?? (other && teamsText(other)) ?? "otra foto"} (${status})`,
        storage_key: other?.storage_key ?? null,
      },
    ]);
  }
  return result;
}

// A photo that looks like one just uploaded, for the notice in the uploader. href is null
// when there is nothing the uploader may open (their own pending proposal).
export type Similar = { href: string | null; label: string };

// For the notice after an admin upload: every lookalike, linking to its admin page.
export async function similarForAdmin(
  supabase: Client,
  photoId: string,
): Promise<Similar[]> {
  const found = await loadLookalikes(supabase, [photoId]);
  return (found.get(photoId) ?? []).map((l) => ({
    href: `/admin/fotos/${l.id}`,
    label: l.label,
  }));
}

// For the notice after a user proposes a photo. As the user, RLS only shows published
// photos and their own proposals, so no draft is ever revealed. Published ones link to
// their public page; their own proposals are named but not linked.
export async function similarForUser(
  supabase: Client,
  photoId: string,
): Promise<Similar[]> {
  const { data: pairs } = await supabase.rpc("photo_lookalikes", {
    photo_ids: [photoId],
  });
  if (!pairs?.length) return [];
  const { data: others } = await supabase
    .from("photos")
    .select("id, slug, status, team, team_2, season_label")
    .in(
      "id",
      pairs.map((p) => p.other_id),
    );
  return (others ?? []).map((o) =>
    o.status === "published"
      ? { href: `/foto/${o.slug}`, label: photoLabel(o) }
      : { href: null, label: "Una foto que ya propusiste" },
  );
}
