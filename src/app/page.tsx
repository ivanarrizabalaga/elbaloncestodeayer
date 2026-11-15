import type { Metadata } from "next";
import Link from "next/link";
import { FaceCrop } from "@/components/face-crop";
import { photoLabel, photoSrc, seasonText } from "@/lib/photos";
import {
  openGraph,
  previewImage,
  SITE_DESCRIPTION,
  SITE_NAME,
} from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { GalleryFilters, type Filters } from "./gallery-filters";

const PAGE_SIZE = 24;

type SearchParams = Awaited<PageProps<"/">["searchParams"]>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function readFilters(params: SearchParams): Filters & { page: number } {
  const decade = Number.parseInt(first(params.decada), 10);
  const page = Number.parseInt(first(params.pagina), 10);
  return {
    decade: Number.isFinite(decade) ? decade - (decade % 10) : null,
    team: first(params.equipo),
    venue: first(params.pabellon),
    unnamed: first(params["sin-nombre"]) === "1",
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 50) : 1,
  };
}

// Home preview: the featured photo (else the latest published one).
export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const { data: featured } = await supabase
    .from("photos")
    .select("slug, team, season_label")
    .eq("status", "published")
    .order("featured", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    alternates: { canonical: "/" },
    openGraph: openGraph({
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: "/",
      images: featured
        ? [previewImage(featured.slug, `Foto: ${photoLabel(featured)}`)]
        : undefined,
    }),
  };
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const filters = readFilters(params);
  const filtering =
    filters.decade !== null ||
    filters.team !== "" ||
    filters.venue !== "" ||
    filters.unnamed;

  const supabase = await createClient();

  // Small archive: one light query gives the totals and the filter options.
  const [{ data: index }, { count: peopleCount }, { data: unnamedTags }] =
    await Promise.all([
      supabase
        .from("photos")
        .select("id, team, venue, year_from")
        .eq("status", "published"),
      supabase
        .from("people")
        .select("id", { count: "exact", head: true })
        .is("merged_into", null),
      // Unidentified faces on published photos (for the filter and «Ayuda a ponerles nombre»).
      supabase
        .from("tags")
        .select(
          "id, x, y, photo:photos!inner(id, slug, status, team, season_label, storage_key, published_at)",
        )
        .is("person_id", null)
        .is("removed_at", null)
        .eq("photo.status", "published"),
    ]);

  const published = index ?? [];
  const unnamed = unnamedTags ?? [];
  const decades = [
    ...new Set(
      published.flatMap((p) =>
        p.year_from ? [p.year_from - (p.year_from % 10)] : [],
      ),
    ),
  ].sort();
  const teams = distinct(published.map((p) => p.team));
  const venues = distinct(published.map((p) => p.venue));
  const unnamedPhotoIds = [...new Set(unnamed.map((t) => t.photo.id))];

  // The gallery itself.
  let query = supabase
    .from("photos")
    .select(
      "id, slug, team, venue, season_label, year_from, storage_key, width, height",
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(0, filters.page * PAGE_SIZE); // one extra row tells us if there is more
  if (filters.decade !== null) {
    query = query
      .gte("year_from", filters.decade)
      .lte("year_from", filters.decade + 9);
  }
  if (filters.team) query = query.eq("team", filters.team);
  if (filters.venue) query = query.eq("venue", filters.venue);
  if (filters.unnamed) query = query.in("id", unnamedPhotoIds);

  const { data: rows } = await query;
  const hasMore = (rows?.length ?? 0) > filters.page * PAGE_SIZE;
  const photos = (rows ?? []).slice(0, filters.page * PAGE_SIZE);

  // Featured photo: the latest one marked as featured, else the latest published.
  const { data: featuredRows } = filtering
    ? { data: [] }
    : await supabase
        .from("photos")
        .select(
          "id, slug, team, venue, season_label, storage_key, width, height",
        )
        .eq("status", "published")
        .order("featured", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(1);
  const featured = featuredRows?.[0];

  // Tag counts for the cards and the featured photo.
  const countIds = [
    ...photos.map((p) => p.id),
    ...(featured ? [featured.id] : []),
  ];
  const { data: tagRows } = countIds.length
    ? await supabase
        .from("tags")
        .select("photo_id, person_id")
        .in("photo_id", countIds)
        .is("removed_at", null)
    : { data: [] };
  const counts = new Map<string, { named: number; unnamed: number }>();
  for (const tag of tagRows ?? []) {
    const c = counts.get(tag.photo_id) ?? { named: 0, unnamed: 0 };
    if (tag.person_id) c.named++;
    else c.unnamed++;
    counts.set(tag.photo_id, c);
  }

  const help = unnamed
    .sort((a, b) =>
      (b.photo.published_at ?? "").localeCompare(a.photo.published_at ?? ""),
    )
    .slice(0, 8);

  if (published.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-16 sm:px-6">
        <h1 className="font-display text-5xl font-bold uppercase sm:text-6xl">
          El baloncesto <span className="text-accent">de ayer</span>
        </h1>
        <p className="max-w-prose text-lg text-muted">
          Archivo fotográfico colaborativo del baloncesto de antes. Todavía no
          hay fotos publicadas: muy pronto podrás reconocerte en ellas,
          etiquetar a tus compañeros e invitarles.
        </p>
        <a
          href="https://www.instagram.com/explore/tags/elbaloncestodeayer/"
          className="inline-flex min-h-11 w-fit items-center rounded-full bg-accent px-6 font-semibold text-on-accent"
        >
          Mientras tanto, en Instagram
        </a>
      </main>
    );
  }

  const nextPage = new URLSearchParams();
  if (filters.decade !== null) nextPage.set("decada", String(filters.decade));
  if (filters.team) nextPage.set("equipo", filters.team);
  if (filters.venue) nextPage.set("pabellon", filters.venue);
  if (filters.unnamed) nextPage.set("sin-nombre", "1");
  nextPage.set("pagina", String(filters.page + 1));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-4 pt-8 sm:px-6">
      {params.cuenta === "borrada" && (
        <p role="status" className="rounded-lg bg-surface-2 px-4 py-3">
          Tu cuenta se ha borrado. Gracias por haber formado parte del archivo.
        </p>
      )}
      {featured?.storage_key && (
        <Featured
          photo={{ ...featured, storage_key: featured.storage_key }}
          count={counts.get(featured.id)}
        />
      )}

      <section aria-labelledby="archivo" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            {/* Without the featured photo, this is the page's main heading. */}
            {featured ? (
              <h2
                id="archivo"
                className="font-display text-[40px] leading-none font-bold"
              >
                El archivo
              </h2>
            ) : (
              <h1
                id="archivo"
                className="font-display text-[40px] leading-none font-bold"
              >
                El archivo
              </h1>
            )}
            <p className="text-muted">
              Fotos de baloncesto de antes y la gente que sale en ellas. Si te
              reconoces, etiquétate.
            </p>
          </div>
          <p className="text-sm text-muted">
            {published.length} {published.length === 1 ? "foto" : "fotos"} ·{" "}
            {peopleCount ?? 0} {peopleCount === 1 ? "persona" : "personas"}
          </p>
        </div>

        <GalleryFilters
          key={JSON.stringify(filters)}
          filters={filters}
          decades={decades}
          teams={teams}
          venues={venues}
        />

        {photos.length === 0 ? (
          <p className="py-8 text-muted">
            No hay fotos con esos filtros.{" "}
            <Link href="/" scroll={false} className="text-accent">
              Quitar filtros
            </Link>
          </p>
        ) : (
          <ul className="columns-[260px] gap-4">
            {photos.map((photo) => {
              const c = counts.get(photo.id) ?? { named: 0, unnamed: 0 };
              return (
                <li key={photo.id} className="mb-5 break-inside-avoid">
                  <Link href={`/foto/${photo.slug}`} className="group block">
                    <span className="relative block overflow-hidden rounded-md bg-surface-3">
                      {photo.storage_key && (
                        // Plain <img>: derivatives are generated at upload time (phase 3).
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photoSrc(photo.storage_key, "thumb")}
                          width={photo.width ?? undefined}
                          height={photo.height ?? undefined}
                          alt={`Foto: ${photoLabel(photo)}`}
                          loading="lazy"
                          className="block h-auto w-full transition-opacity group-hover:opacity-80"
                        />
                      )}
                      {c.unnamed > 0 && (
                        <span className="absolute top-2.5 left-2.5 rounded-full bg-bg px-2.5 py-1 text-xs font-semibold text-accent">
                          {c.unnamed} sin nombre
                        </span>
                      )}
                    </span>
                    <span className="flex justify-between gap-2 pt-2 text-[13px] text-muted">
                      <span className="font-medium text-fg">
                        {[photo.season_label, photo.team ?? photo.venue]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span className="flex-none">
                        {c.named} {c.named === 1 ? "etiquetado" : "etiquetados"}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && (
          <div className="flex justify-center">
            <Link
              href={`/?${nextPage}`}
              scroll={false}
              className="inline-flex h-11 items-center rounded-full border border-line-strong px-6 font-medium"
            >
              Ver más fotos
            </Link>
          </div>
        )}
      </section>

      {help.length > 0 && !filters.unnamed && (
        <section
          aria-labelledby="ayuda"
          className="flex flex-col gap-5 rounded-lg bg-surface-2 p-5 sm:p-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2
                id="ayuda"
                className="font-display text-4xl leading-none font-bold"
              >
                Ayuda a ponerles nombre
              </h2>
              <p className="text-muted">
                Caras que todavía nadie ha identificado. Si sabes quién es,
                díselo al archivo.
              </p>
            </div>
            <Link
              href="/?sin-nombre=1"
              scroll={false}
              className="inline-flex min-h-11 items-center text-sm font-medium text-accent"
            >
              Ver todas →
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {help.map((tag) => (
              <li key={tag.id}>
                <Link
                  href={`/foto/${tag.photo.slug}`}
                  className="flex flex-col gap-2"
                >
                  {tag.photo.storage_key && (
                    <FaceCrop
                      src={photoSrc(tag.photo.storage_key)}
                      x={tag.x}
                      y={tag.y}
                      alt=""
                      className="aspect-square rounded-md"
                    >
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-accent bg-bg/60 font-display text-[32px] font-bold text-accent">
                          ?
                        </span>
                      </span>
                    </FaceCrop>
                  )}
                  <span className="text-sm font-medium">
                    {[tag.photo.season_label, tag.photo.team]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Featured({
  photo,
  count,
}: {
  photo: {
    slug: string;
    team: string | null;
    venue: string | null;
    season_label: string | null;
    storage_key: string;
  };
  count: { named: number; unnamed: number } | undefined;
}) {
  const named = count?.named ?? 0;
  const total = named + (count?.unnamed ?? 0);
  const href = `/foto/${photo.slug}`;
  return (
    <section
      aria-labelledby="destacada"
      className="relative flex flex-col overflow-hidden rounded-lg bg-surface-2 sm:min-h-[clamp(360px,42vw,600px)] sm:justify-end sm:bg-surface-3 sm:p-8"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoSrc(photo.storage_key)}
        alt=""
        className="aspect-[3/2] w-full object-cover sm:absolute sm:inset-0 sm:aspect-auto sm:h-full"
      />
      {/* Mobile: photo, then text. From sm up: text box over the photo. */}
      <div className="relative flex max-w-[560px] flex-col gap-2.5 px-5 py-5 sm:rounded-lg sm:bg-bg/86 sm:px-7 sm:py-6">
        <span className="text-xs font-semibold tracking-[0.12em] text-accent uppercase">
          Foto de la semana
        </span>
        <h1
          id="destacada"
          className="font-display text-[clamp(32px,3.6vw,48px)] leading-[1.02] font-bold"
        >
          {[photo.team, photo.season_label && seasonText(photo.season_label)]
            .filter(Boolean)
            .join(" · ") || photoLabel(photo)}
        </h1>
        {total > 0 && (
          <p className="text-[15px] text-[#c8c8c8]">
            {photo.venue && `${photo.venue} · `}
            {named} de {total} personas identificadas.
            {named < total && " ¿Conoces a los que faltan?"}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-3">
          <Link
            href={href}
            className="inline-flex h-11 items-center rounded-full bg-accent px-5 font-semibold text-on-accent"
          >
            Ver la foto
          </Link>
          {named < total && (
            <Link
              href={href}
              className="inline-flex h-11 items-center rounded-full border border-[#5a5a5a] px-5 font-medium"
            >
              Ayudar a identificar
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function distinct(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort(
    (a, b) => a.localeCompare(b, "es"),
  );
}
