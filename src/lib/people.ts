import "server-only";
import { slugify, uniqueSlug } from "@/lib/slug";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

// What the person search shows: name plus «4 fotos · CB Ribera · 1982–86» to tell people apart.
export type PersonOption = { id: string; name: string; detail: string };

export async function loadPersonOptions(
  supabase: Client,
): Promise<PersonOption[]> {
  const { data: people } = await supabase
    .from("people")
    .select("id, full_name, tags(photo:photos(team, team_2, year_from))")
    .is("merged_into", null)
    .is("tags.removed_at", null)
    .order("full_name");

  return (people ?? []).map((person) => {
    const photos = person.tags.flatMap((t) => (t.photo ? [t.photo] : []));
    const years = photos.flatMap((p) => (p.year_from ? [p.year_from] : []));
    const teams = [...new Set(photos.flatMap((p) => (p.team ? [p.team] : [])))];
    return {
      id: person.id,
      name: person.full_name,
      detail: [
        `${photos.length} ${photos.length === 1 ? "foto" : "fotos"}`,
        teams.slice(0, 2).join(", "),
        yearRange(years),
      ]
        .filter(Boolean)
        .join(" · "),
    };
  });
}

// Admins only (RLS): a new person with a unique slug.
export async function createPerson(
  supabase: Client,
  fullName: string,
  createdBy: string,
): Promise<string | null> {
  const name = fullName.trim().replace(/\s+/g, " ");
  if (!name) return null;
  const base = slugify(name);
  const { data: similar } = await supabase
    .from("people")
    .select("slug")
    .like("slug", `${base}%`);
  const { data, error } = await supabase
    .from("people")
    .insert({
      full_name: name,
      slug: uniqueSlug(
        base,
        (similar ?? []).map((p) => p.slug),
      ),
      created_by: createdBy,
    })
    .select("id")
    .single();
  return error ? null : data.id;
}

// Next label number among the active tags of a photo.
export async function nextLabelNumber(
  supabase: Client,
  photoId: string,
): Promise<number> {
  const { data } = await supabase
    .from("tags")
    .select("label_number")
    .eq("photo_id", photoId)
    .is("removed_at", null)
    .order("label_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.label_number ?? 0) + 1;
}

// «1978», or «1978–84» across several seasons.
function yearRange(years: number[]): string {
  if (years.length === 0) return "";
  const from = Math.min(...years);
  const to = Math.max(...years);
  return from === to ? String(from) : `${from}–${String(to).slice(-2)}`;
}
