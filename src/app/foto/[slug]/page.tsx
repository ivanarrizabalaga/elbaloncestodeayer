import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PhotoGrid } from "@/components/photo-grid";
import { WhatsAppShare } from "@/components/whatsapp-share";
import { decadeLabel, photoLabel, photoSrc, photoTitle } from "@/lib/photos";
import { initials, siteOrigin } from "@/lib/site";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { PhotoView, type PhotoTag } from "./photo-view";

// RLS decides what is visible: published photos for everyone, drafts only for admins.
const getPhoto = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("photos")
    .select(
      "id, slug, status, season_label, year_from, team, venue, competition, provenance, photographer, story, instagram_url, storage_key, width, height",
    )
    .eq("slug", slug)
    .maybeSingle();
  return data;
});

export async function generateMetadata({
  params,
}: PageProps<"/foto/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const photo = await getPhoto(slug);
  if (!photo) return {};
  return { title: photoLabel(photo), description: photo.story ?? undefined };
}

export default async function PhotoPage({ params }: PageProps<"/foto/[slug]">) {
  const { slug } = await params;
  const photo = await getPhoto(slug);
  if (!photo || !photo.storage_key || !photo.width || !photo.height) {
    notFound();
  }

  const supabase = await createClient();
  const user = await getCurrentUser();
  const [tagsResult, memoriesResult, moreResult] = await Promise.all([
    supabase
      .from("tags")
      .select(
        "id, x, y, label_number, person:people(id, full_name, slug, claimed_by)",
      )
      .eq("photo_id", photo.id)
      .is("removed_at", null)
      .order("label_number"),
    supabase
      .from("memories")
      .select("id, body, author_id")
      .eq("photo_id", photo.id)
      .is("hidden_at", null)
      .order("created_at"),
    photo.season_label
      ? supabase
          .from("photos")
          .select("id, slug, team, season_label, storage_key, width, height")
          .eq("status", "published")
          .eq("season_label", photo.season_label)
          .neq("id", photo.id)
          .order("published_at", { ascending: false })
          .limit(4)
      : Promise.resolve({ data: [] }),
  ]);

  const tagRows = tagsResult.data ?? [];
  const memories = memoriesResult.data ?? [];
  const morePhotos = moreResult.data ?? [];

  const tags: PhotoTag[] = tagRows.map((tag) => ({
    id: tag.id,
    number: tag.label_number,
    x: tag.x,
    y: tag.y,
    person: tag.person
      ? {
          id: tag.person.id,
          name: tag.person.full_name,
          slug: tag.person.slug,
          claimed: tag.person.claimed_by !== null,
        }
      : null,
  }));

  // Memory authors: public names come from the profile_names view.
  const authorIds = [
    ...new Set(memories.flatMap((m) => (m.author_id ? [m.author_id] : []))),
  ];
  const { data: authors } = authorIds.length
    ? await supabase
        .from("profile_names")
        .select("id, display_name")
        .in("id", authorIds)
    : { data: [] };
  const authorName = new Map(
    (authors ?? []).map((a) => [a.id, a.display_name]),
  );
  // Authors who are tagged in this photo get «sale en la foto».
  const taggedAccounts = new Set(
    tagRows.flatMap((t) => (t.person?.claimed_by ? [t.person.claimed_by] : [])),
  );

  const title = photoTitle(photo);
  const decade = decadeLabel(photo.year_from);
  const shareUrl = `${await siteOrigin()}/foto/${photo.slug}`;
  const shareText = `¿Sales en esta foto? ${photoLabel(photo)} — El baloncesto de ayer`;

  const details = [
    ["Lugar", photo.venue],
    ["Competición", photo.competition],
    ["Procedencia", photo.provenance],
    ["Autor", photo.photographer],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pt-6 sm:px-6">
      <nav aria-label="Ruta" className="text-sm text-muted">
        <Link
          href="/"
          className="underline-offset-4 hover:text-fg hover:underline"
        >
          Archivo
        </Link>
        {decade && (
          <>
            {" "}
            <span aria-hidden="true">/</span> {decade}
          </>
        )}{" "}
        <span aria-hidden="true">/</span>{" "}
        <span className="text-fg">{photoLabel(photo)}</span>
      </nav>

      {user?.isAdmin && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-2 text-sm ${photo.status === "published" ? "bg-surface-2" : "border border-accent"}`}
        >
          <span>
            {photo.status === "published"
              ? "Eres admin."
              : `Esta foto no es pública (estado: ${photo.status}). Solo la ves porque eres admin.`}
          </span>
          <Link
            href={`/admin/fotos/${photo.id}`}
            className="inline-flex min-h-11 items-center font-semibold text-accent"
          >
            Editar foto →
          </Link>
        </div>
      )}

      <PhotoView
        src={photoSrc(photo.storage_key)}
        width={photo.width}
        height={photo.height}
        alt={`Foto: ${photoLabel(photo)}`}
        tags={tags}
        canInvite={Boolean(user)}
        heading={
          <div className="flex flex-col gap-1.5">
            {photo.season_label && (
              <span className="text-xs font-semibold tracking-[0.12em] text-accent uppercase">
                Temporada {photo.season_label}
              </span>
            )}
            <h1 className="font-display text-[44px] leading-none font-bold">
              {title}
            </h1>
          </div>
        }
        details={
          details.length > 0 || photo.instagram_url ? (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-5 gap-y-2.5 text-sm">
              {details.map(([term, value]) => (
                <div key={term} className="contents">
                  <dt className="text-muted">{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
              {photo.instagram_url && (
                <div className="contents">
                  <dt className="text-muted">Instagram</dt>
                  <dd>
                    <a href={photo.instagram_url} className="text-accent">
                      Ver publicación ↗
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          ) : null
        }
        actions={
          <WhatsAppShare text={shareText} url={shareUrl} className="mt-1.5" />
        }
        story={
          photo.story || memories.length > 0 ? (
            <section aria-labelledby="historia" className="flex flex-col gap-4">
              <h2
                id="historia"
                className="font-display text-[30px] leading-none font-bold"
              >
                La historia
              </h2>
              {photo.story && (
                <p className="max-w-[720px] text-[17px] whitespace-pre-line text-[#dadada]">
                  {photo.story}
                </p>
              )}
              {memories.length > 0 && (
                <ul className="mt-2 flex flex-col gap-4">
                  {memories.map((memory) => {
                    const name =
                      (memory.author_id && authorName.get(memory.author_id)) ||
                      "Alguien";
                    return (
                      <li key={memory.id} className="flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          className="flex size-9 flex-none items-center justify-center rounded-full bg-[#2e2e2e] text-[13px] font-semibold"
                        >
                          {initials(name)}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold">
                            {name}
                            {memory.author_id &&
                              taggedAccounts.has(memory.author_id) && (
                                <span className="font-normal text-muted">
                                  {" "}
                                  · sale en la foto
                                </span>
                              )}
                          </span>
                          <p className="whitespace-pre-line text-[#dadada]">
                            {memory.body}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null
        }
      />

      {morePhotos.length > 0 && (
        <section aria-labelledby="mas" className="flex flex-col gap-4">
          <h2
            id="mas"
            className="font-display text-[30px] leading-none font-bold"
          >
            Más de la temporada {photo.season_label}
          </h2>
          <PhotoGrid photos={morePhotos} />
        </section>
      )}
    </main>
  );
}
