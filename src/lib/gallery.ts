import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type SearchParams = Record<string, string | string[] | undefined>;

// The gallery filters, kept in the URL (`/?decada=1970&equipo=…`). Photo pages opened from
// the gallery carry them too, so previous/next follow the same list.
export type GalleryFilters = {
  decade: number | null;
  team: string;
  venue: string;
  unnamed: boolean;
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function readGalleryFilters(params: SearchParams): GalleryFilters {
  const decade = Number.parseInt(first(params.decada), 10);
  return {
    decade: Number.isFinite(decade) ? decade - (decade % 10) : null,
    team: first(params.equipo),
    venue: first(params.pabellon),
    unnamed: first(params["sin-nombre"]) === "1",
  };
}

export function isFiltering(filters: GalleryFilters): boolean {
  return (
    filters.decade !== null ||
    filters.team !== "" ||
    filters.venue !== "" ||
    filters.unnamed
  );
}

// The filters as a query string («decada=1970&equipo=CAU»), empty when there are none.
export function galleryQuery(filters: GalleryFilters): URLSearchParams {
  const query = new URLSearchParams();
  if (filters.decade !== null) query.set("decada", String(filters.decade));
  if (filters.team) query.set("equipo", filters.team);
  if (filters.venue) query.set("pabellon", filters.venue);
  if (filters.unnamed) query.set("sin-nombre", "1");
  return query;
}

// «/foto/x?decada=1970», or «/foto/x» when not filtering.
export function withQuery(path: string, query: URLSearchParams): string {
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

// Published photos with an unidentified face (the «sin nombre» filter).
export async function unnamedPhotoIds(supabase: Client): Promise<string[]> {
  const { data } = await supabase
    .from("tags")
    .select("photo:photos!inner(id)")
    .is("person_id", null)
    .is("removed_at", null)
    .eq("photo.status", "published");
  return [...new Set((data ?? []).map((t) => t.photo.id))];
}

interface Filterable<T> {
  gte(column: string, value: number): T;
  lte(column: string, value: number): T;
  eq(column: string, value: string): T;
  in(column: string, values: readonly string[]): T;
}

export function applyGalleryFilters<T extends Filterable<T>>(
  query: T,
  filters: GalleryFilters,
  unnamedIds: readonly string[],
): T {
  let q = query;
  if (filters.decade !== null) {
    q = q.gte("year_from", filters.decade).lte("year_from", filters.decade + 9);
  }
  if (filters.team) q = q.eq("team", filters.team);
  if (filters.venue) q = q.eq("venue", filters.venue);
  if (filters.unnamed) q = q.in("id", unnamedIds);
  return q;
}

// Gallery order: newest published first. `id` breaks ties (bulk publishing gives many
// photos the same published_at), so the order is stable and previous/next never loop.
//
// The photos before and after this one in the filtered gallery list, by slug.
export async function photoNeighbours(
  supabase: Client,
  photo: { id: string; published_at: string },
  filters: GalleryFilters,
): Promise<{ previous: string | null; next: string | null }> {
  const unnamedIds = filters.unnamed ? await unnamedPhotoIds(supabase) : [];
  // Quoted: timestamps contain characters PostgREST reserves in `or` filters.
  const at = `"${photo.published_at}"`;
  const base = () =>
    applyGalleryFilters(
      supabase.from("photos").select("slug").eq("status", "published"),
      filters,
      unnamedIds,
    );
  const [previous, next] = await Promise.all([
    base()
      .or(`published_at.gt.${at},and(published_at.eq.${at},id.gt.${photo.id})`)
      .order("published_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),
    base()
      .or(`published_at.lt.${at},and(published_at.eq.${at},id.lt.${photo.id})`)
      .order("published_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    previous: previous.data?.slug ?? null,
    next: next.data?.slug ?? null,
  };
}
