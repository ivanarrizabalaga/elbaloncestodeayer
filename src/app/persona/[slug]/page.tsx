import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { FaceCrop } from "@/components/face-crop";
import { PhotoGrid, type GridPhoto } from "@/components/photo-grid";
import { WhatsAppShare } from "@/components/whatsapp-share";
import { photoLabel, photoSrc } from "@/lib/photos";
import { openGraph, previewImage } from "@/lib/seo";
import { initials, siteOrigin } from "@/lib/site";
import { INVITATION_ERRORS } from "@/lib/invitations";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { claimPerson } from "@/app/invitacion/actions";
import { InviteButton } from "@/components/invite-button";

const getPerson = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("people")
    .select("id, full_name, slug, bio, claimed_by, merged_into")
    .eq("slug", slug)
    .maybeSingle();
  return data;
});

export async function generateMetadata({
  params,
}: PageProps<"/persona/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const person = await getPerson(slug);
  if (!person || person.merged_into) return {};

  // Preview image: their most recent published photo.
  const supabase = await createClient();
  const { data: tags } = await supabase
    .from("tags")
    .select("photo:photos!inner(slug, status, published_at)")
    .eq("person_id", person.id)
    .is("removed_at", null)
    .eq("photo.status", "published");
  const photos = (tags ?? [])
    .map((t) => t.photo)
    .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  const count = photos.length;
  const description =
    count > 0
      ? `${person.full_name} sale en ${count === 1 ? "1 foto" : `${count} fotos`} de El baloncesto de ayer. ¿Le conoces?`
      : `${person.full_name} en El baloncesto de ayer.`;

  return {
    title: person.full_name,
    description,
    alternates: { canonical: `/persona/${person.slug}` },
    openGraph: openGraph({
      type: "profile",
      title: person.full_name,
      description,
      url: `/persona/${person.slug}`,
      images: photos[0]
        ? [
            previewImage(
              photos[0].slug,
              `Foto en la que sale ${person.full_name}`,
            ),
          ]
        : undefined,
    }),
  };
}

export default async function PersonPage({
  params,
  searchParams,
}: PageProps<"/persona/[slug]">) {
  const { slug } = await params;
  const { bienvenida, error } = await searchParams;
  const person = await getPerson(slug);
  if (!person) notFound();

  const supabase = await createClient();
  const user = await getCurrentUser();
  const isMe = Boolean(user && person.claimed_by === user.id);
  // «Este soy yo» only for signed-in accounts not linked to anyone yet.
  const { data: ownPerson } = user
    ? await supabase
        .from("people")
        .select("id")
        .eq("claimed_by", user.id)
        .maybeSingle()
    : { data: null };
  const canClaim = Boolean(user && !person.claimed_by && !ownPerson);
  const problem =
    typeof error === "string" ? INVITATION_ERRORS[error] : undefined;

  // A merged duplicate sends visitors to the person it was merged into.
  if (person.merged_into) {
    const { data: target } = await supabase
      .from("people")
      .select("slug")
      .eq("id", person.merged_into)
      .maybeSingle();
    if (target) permanentRedirect(`/persona/${target.slug}`);
  }

  // Their tags on published photos (admins could otherwise see drafts here).
  const { data: ownTags } = await supabase
    .from("tags")
    .select(
      "x, y, photo:photos!inner(id, slug, status, team, season_label, year_from, competition, storage_key, width, height, published_at)",
    )
    .eq("person_id", person.id)
    .is("removed_at", null)
    .eq("photo.status", "published");

  const appearances = (ownTags ?? []).sort(
    (a, b) => (b.photo.year_from ?? 0) - (a.photo.year_from ?? 0),
  );
  const photoIds = appearances.map((tag) => tag.photo.id);

  // Everyone tagged in those photos: tag counts and «Sale con».
  const { data: photoTags } = photoIds.length
    ? await supabase
        .from("tags")
        .select("photo_id, person:people(id, full_name, slug)")
        .in("photo_id", photoIds)
        .is("removed_at", null)
    : { data: [] };

  const tagCount = new Map<string, number>();
  const companions = new Map<
    string,
    { name: string; slug: string; count: number }
  >();
  for (const tag of photoTags ?? []) {
    tagCount.set(tag.photo_id, (tagCount.get(tag.photo_id) ?? 0) + 1);
    if (tag.person && tag.person.id !== person.id) {
      const current = companions.get(tag.person.id);
      companions.set(tag.person.id, {
        name: tag.person.full_name,
        slug: tag.person.slug,
        count: (current?.count ?? 0) + 1,
      });
    }
  }
  const topCompanions = [...companions.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"))
    .slice(0, 12);

  // Photos grouped by season, newest first.
  const seasons = new Map<
    string,
    { teams: Set<string>; photos: GridPhoto[] }
  >();
  for (const { photo } of appearances) {
    const key = photo.season_label ?? "Sin fecha";
    const season = seasons.get(key) ?? { teams: new Set(), photos: [] };
    if (photo.team) season.teams.add(photo.team);
    const count = tagCount.get(photo.id) ?? 1;
    season.photos.push({
      ...photo,
      caption: [
        photo.competition ?? photo.team,
        `${count} ${count === 1 ? "etiquetado" : "etiquetados"}`,
      ]
        .filter(Boolean)
        .join(" · "),
    });
    seasons.set(key, season);
  }

  const years = appearances.flatMap((t) =>
    t.photo.year_from ? [t.photo.year_from] : [],
  );
  const teams = [
    ...new Set(
      appearances.flatMap((t) => (t.photo.team ? [t.photo.team] : [])),
    ),
  ];
  const summary = [
    appearances.length === 1
      ? "Aparece en 1 foto"
      : `Aparece en ${appearances.length} fotos`,
    years.length > 0 &&
      (Math.min(...years) === Math.max(...years)
        ? `en ${years[0]}`
        : `de ${Math.min(...years)} a ${Math.max(...years)}`),
    teams.join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  // Face crop from their most recent photo.
  const portrait = appearances.find((t) => t.photo.storage_key);
  const shareUrl = `${await siteOrigin()}/persona/${person.slug}`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-4 pt-10 sm:px-6">
      {bienvenida === "1" && isMe && (
        <section
          aria-labelledby="bienvenida"
          className="flex flex-col gap-2 rounded-lg bg-surface-2 p-5 sm:p-6"
        >
          <h2
            id="bienvenida"
            className="font-display text-3xl leading-none font-bold"
          >
            Ya estás dentro, {person.full_name.split(" ")[0]}
          </h2>
          <p className="text-muted">
            Tu cuenta ya está enlazada con tu página. Abre cualquier foto en la
            que salgas para ver quién más aparece e invitar a tus compañeros.
            Puedes quitar tus etiquetas cuando quieras.
          </p>
        </section>
      )}
      {problem && (
        <p
          role="alert"
          className="rounded-lg border border-accent px-4 py-3 text-sm"
        >
          {problem}
        </p>
      )}
      <section
        aria-labelledby="nombre"
        className="flex flex-wrap items-end gap-10"
      >
        {portrait?.photo.storage_key && (
          <FaceCrop
            src={photoSrc(portrait.photo.storage_key)}
            x={portrait.x}
            y={portrait.y}
            alt={`${person.full_name} en una foto de ${photoLabel(portrait.photo)}`}
            className="aspect-[4/5] w-40 flex-none rounded-lg sm:w-auto sm:min-w-60 sm:flex-[0_1_340px]"
          >
            <span className="absolute bottom-3 left-3 hidden rounded-md bg-bg/85 px-2.5 py-1 text-xs text-[#c8c8c8] sm:block">
              De la foto de {photoLabel(portrait.photo)}
            </span>
          </FaceCrop>
        )}
        <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-4">
          {person.claimed_by && (
            <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-line-strong px-3 py-1 text-[13px] text-[#c8c8c8]">
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className="stroke-accent"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12l5 5 9-10" />
              </svg>
              Perfil reclamado
            </span>
          )}
          <h1
            id="nombre"
            className="font-display text-[clamp(56px,7vw,104px)] leading-[0.92] font-bold tracking-[-0.01em]"
          >
            {person.full_name}
          </h1>
          <p className="text-lg text-[#c8c8c8]">{summary}</p>
          {person.bio && (
            <p className="max-w-[640px] whitespace-pre-line text-muted">
              {person.bio}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-start gap-3">
            <WhatsAppShare
              primary
              text={`${person.full_name} en El baloncesto de ayer`}
              url={shareUrl}
            />
            {user && !person.claimed_by && (
              <InviteButton
                personId={person.id}
                personName={person.full_name}
                label={`Invitar a ${person.full_name.split(" ")[0]}`}
                className="h-12! px-5! text-base!"
              />
            )}
            {canClaim && (
              <form action={claimPerson}>
                <input type="hidden" name="personId" value={person.id} />
                <input type="hidden" name="slug" value={person.slug} />
                <button
                  type="submit"
                  className="inline-flex h-12 items-center rounded-full px-5 text-muted underline-offset-4 hover:text-fg hover:underline"
                >
                  Este soy yo
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {topCompanions.length > 0 && (
        <section aria-labelledby="sale-con" className="flex flex-col gap-4">
          <h2
            id="sale-con"
            className="font-display text-[30px] leading-none font-bold"
          >
            Sale con
          </h2>
          <ul className="flex flex-wrap gap-2.5">
            {topCompanions.map((companion) => (
              <li key={companion.slug}>
                <Link
                  href={`/persona/${companion.slug}`}
                  className="inline-flex h-12 items-center gap-2.5 rounded-full bg-surface-2 pr-4 pl-1.5 font-medium hover:bg-surface-3"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 items-center justify-center rounded-full bg-[#2e2e2e] text-[13px] font-semibold"
                  >
                    {initials(companion.name)}
                  </span>
                  {companion.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="fotos" className="flex flex-col gap-10">
        <h2
          id="fotos"
          className="font-display text-[40px] leading-none font-bold"
        >
          Sus fotos, temporada a temporada
        </h2>
        {seasons.size === 0 ? (
          <p className="text-muted">Todavía no aparece en ninguna foto.</p>
        ) : (
          [...seasons].map(([label, season]) => (
            <div key={label} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line pb-2.5">
                <h3 className="font-display text-[28px] leading-none font-semibold">
                  {label}
                </h3>
                <span className="text-sm text-muted">
                  {[
                    [...season.teams].join(", "),
                    `${season.photos.length} ${season.photos.length === 1 ? "foto" : "fotos"}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <PhotoGrid photos={season.photos} />
            </div>
          ))
        )}
      </section>
    </main>
  );
}
