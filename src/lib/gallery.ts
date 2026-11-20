import "server-only";
import { decadeLabel } from "@/lib/photos";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type SearchParams = Record<string, string | string[] | undefined>;

// The gallery filters, kept in the URL (`/?decada=1970&equipo=…`). Photo pages opened from
// the gallery carry them too, so previous/next follow the same list.
//
// Competition has no control in the filter bar (it would crowd it on mobile): it is
// reached from a photo page, and shown as an active-filter chip.
export type GalleryFilters = {
  decade: number | null;
  team: string;
  venue: string;
  competition: string;
  unnamed: boolean;
};

export const NO_FILTERS: GalleryFilters = {
  decade: null,
  team: "",
  venue: "",
  competition: "",
  unnamed: false,
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
    competition: first(params.competicion),
    unnamed: first(params["sin-nombre"]) === "1",
  };
}

export function isFiltering(filters: GalleryFilters): boolean {
  return galleryQuery(filters).size > 0;
}

// The filters as a query string («decada=1970&equipo=CAU»), empty when there are none.
export function galleryQuery(filters: GalleryFilters): URLSearchParams {
  const query = new URLSearchParams();
  if (filters.decade !== null) query.set("decada", String(filters.decade));
  if (filters.team) query.set("equipo", filters.team);
  if (filters.venue) query.set("pabellon", filters.venue);
  if (filters.competition) query.set("competicion", filters.competition);
  if (filters.unnamed) query.set("sin-nombre", "1");
  return query;
}

// The gallery filtered by one value only: what the values on a photo page link to.
export function galleryHref(only: Partial<GalleryFilters>): string {
  return withQuery("/", galleryQuery({ ...NO_FILTERS, ...only }));
}

// ---------------------------------------------------------------------------
// Filter bar options. The archive is small: the gallery page loads every published
// photo's filterable fields once, and the options are worked out here in memory.
// ---------------------------------------------------------------------------

export type IndexRow = {
  id: string;
  team: string | null;
  team_2: string | null;
  venue: string | null;
  competition: string | null;
  year_from: number | null;
};

type Facet = "decade" | "team" | "venue" | "competition" | "unnamed";

export function decadeOf(year: number | null): number | null {
  return year === null ? null : year - (year % 10);
}

function matches(
  row: IndexRow,
  filters: GalleryFilters,
  unnamed: ReadonlySet<string>,
  except: Facet | null,
): boolean {
  return (
    (except === "decade" ||
      filters.decade === null ||
      decadeOf(row.year_from) === filters.decade) &&
    (except === "team" ||
      !filters.team ||
      row.team === filters.team ||
      row.team_2 === filters.team) &&
    (except === "venue" || !filters.venue || row.venue === filters.venue) &&
    (except === "competition" ||
      !filters.competition ||
      row.competition === filters.competition) &&
    (except === "unnamed" || !filters.unnamed || unnamed.has(row.id))
  );
}

export type Option<T> = { value: T; count: number };

// Each option lists only values that still give photos with the *other* filters applied
// (pick «Años 80» and the team list only shows teams with photos in the 80s), with how
// many. The selected value always stays, even at 0, so the control shows it.
function options<T extends string | number>(
  rows: IndexRow[],
  filters: GalleryFilters,
  unnamed: ReadonlySet<string>,
  facet: Facet,
  // A photo can give more than one value (its two teams).
  valuesOf: (row: IndexRow) => (T | null)[],
  selected: T | null,
): Option<T>[] {
  const counts = new Map<T, number>();
  for (const row of rows) {
    if (!matches(row, filters, unnamed, facet)) continue;
    for (const value of new Set(valuesOf(row))) {
      if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  if (selected !== null && selected !== "" && !counts.has(selected)) {
    counts.set(selected, 0);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) =>
      typeof a.value === "number"
        ? (a.value as number) - (b.value as number)
        : String(a.value).localeCompare(String(b.value), "es"),
    );
}

export function filterOptions(
  rows: IndexRow[],
  filters: GalleryFilters,
  unnamed: ReadonlySet<string>,
) {
  return {
    // How many photos the current filters give.
    matching: rows.filter((r) => matches(r, filters, unnamed, null)).length,
    decades: options(
      rows,
      filters,
      unnamed,
      "decade",
      (r) => [decadeOf(r.year_from)],
      filters.decade,
    ),
    teams: options(
      rows,
      filters,
      unnamed,
      "team",
      (r) => [r.team, r.team_2],
      filters.team,
    ),
    venues: options(
      rows,
      filters,
      unnamed,
      "venue",
      (r) => [r.venue],
      filters.venue,
    ),
  };
}

// The active filters as removable chips: label, and the gallery URL without that filter.
export function activeFilters(
  filters: GalleryFilters,
): { label: string; href: string }[] {
  const without = (change: Partial<GalleryFilters>) =>
    withQuery("/", galleryQuery({ ...filters, ...change }));
  const chips: { label: string; href: string }[] = [];
  if (filters.decade !== null) {
    chips.push({
      label: decadeLabel(filters.decade) ?? String(filters.decade),
      href: without({ decade: null }),
    });
  }
  if (filters.team) {
    chips.push({ label: filters.team, href: without({ team: "" }) });
  }
  if (filters.venue) {
    chips.push({ label: filters.venue, href: without({ venue: "" }) });
  }
  if (filters.competition) {
    chips.push({
      label: filters.competition,
      href: without({ competition: "" }),
    });
  }
  if (filters.unnamed) {
    chips.push({
      label: "Caras sin nombre",
      href: without({ unnamed: false }),
    });
  }
  return chips;
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
  or(filters: string): T;
}

// A value inside a PostgREST or() filter: quoted, so commas and brackets are literal.
function quoted(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
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
  if (filters.team) {
    const team = quoted(filters.team);
    q = q.or(`team.eq.${team},team_2.eq.${team}`);
  }
  if (filters.venue) q = q.eq("venue", filters.venue);
  if (filters.competition) q = q.eq("competition", filters.competition);
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
