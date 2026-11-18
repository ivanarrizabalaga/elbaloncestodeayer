import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { discardDrafts } from "@/app/admin/subir/actions";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/confirm-button";
import { LookalikeList } from "@/components/lookalike-list";
import { Field, PhotoDetailsFields } from "@/components/photo-details-fields";
import { loadLookalikes } from "@/lib/lookalikes";
import { loadPersonOptions } from "@/lib/people";
import { loadDetailSuggestions } from "@/lib/photo-details";
import { PHOTO_STATUS_LABEL, photoLabel, photoSrc } from "@/lib/photos";
import { payloadText, withdrawnByContributor } from "@/lib/review";
import { createClient } from "@/lib/supabase/server";
import { savePhoto, withdrawPhoto } from "./actions";
import { TagEditor } from "./tag-editor";

export const metadata: Metadata = { title: "Editar foto" };

const MESSAGES: Record<string, string> = {
  guardada: "Cambios guardados.",
  publicada: "Foto publicada.",
  retirada: "Foto retirada: ya no se ve en la web. Puedes volver a publicarla.",
};
const ERRORS: Record<string, string> = {
  guardar: "No se pudieron guardar los cambios.",
  retirada:
    "Esta foto está retirada y no se puede volver a publicar desde aquí.",
  instagram:
    "El enlace de Instagram debe empezar por https://www.instagram.com/",
};

export default async function EditPhotoPage({
  params,
  searchParams,
}: PageProps<"/admin/fotos/[id]">) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const supabase = await createClient();

  const { data: photo } = await supabase
    .from("photos")
    .select(
      "id, slug, status, season_label, team, venue, competition, provenance, photographer, story, instagram_url, featured, storage_key, width, height, proposed_by",
    )
    .eq("id", id)
    .maybeSingle();
  if (!photo || !photo.storage_key || !photo.width || !photo.height) {
    notFound();
  }

  const [{ data: tags }, personOptions, suggestions, lookalikes] =
    await Promise.all([
      supabase
        .from("tags")
        .select("id, x, y, label_number, person:people(full_name)")
        .eq("photo_id", id)
        .is("removed_at", null)
        .order("label_number"),
      loadPersonOptions(supabase),
      loadDetailSuggestions(supabase),
      loadLookalikes(supabase, [id]),
    ]);

  const published = photo.status === "published";
  // Only one photo of the week at a time (database trigger): say which one it replaces.
  const { data: currentFeatured } = photo.featured
    ? { data: null }
    : await supabase
        .from("photos")
        .select("slug, team, season_label")
        .eq("featured", true)
        .maybeSingle();
  // Drafts and user proposals can be published; withdrawn photos stay down (SPEC §5).
  const ownWithdrawal =
    photo.status === "withdrawn" &&
    (await withdrawnByContributor(supabase, photo.id));
  const publishable =
    photo.status === "draft" ||
    photo.status === "proposed" ||
    (photo.status === "withdrawn" && !ownWithdrawal);
  const proposal = photo.proposed_by
    ? await loadProposal(supabase, photo.id, photo.proposed_by)
    : null;
  const message = typeof ok === "string" ? MESSAGES[ok] : undefined;
  const problem = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <BackLink
            fallback="/admin/subir"
            className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
          >
            ← Volver
          </BackLink>
          <h1 className="font-display text-[40px] leading-none font-bold">
            {published ? "Editar foto" : "Etiquetar y publicar"}
          </h1>
        </div>
        <span className="flex items-center gap-3 text-sm">
          <span
            className={`rounded-full px-3 py-1 font-semibold ${published ? "bg-accent text-on-accent" : "border border-line-strong"}`}
          >
            {PHOTO_STATUS_LABEL[photo.status]}
          </span>
          <Link
            href={`/foto/${photo.slug}`}
            className="inline-flex min-h-11 items-center text-accent"
          >
            Ver ficha →
          </Link>
        </span>
      </div>

      {(message || problem) && (
        <p
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${problem ? "border border-accent" : "bg-surface-2"}`}
        >
          {problem ?? message}
        </p>
      )}

      {proposal && (
        <section
          aria-label="Propuesta"
          className="flex flex-col gap-1 rounded-lg bg-surface-2 px-4 py-3 text-sm"
        >
          <p>
            Propuesta por <strong>{proposal.name}</strong>.
            {photo.status === "withdrawn" &&
              " La retiró quien la aportó: no la vuelvas a publicar salvo que te lo pida."}
          </p>
          {proposal.comment && (
            <p className="text-muted">Comentario: «{proposal.comment}»</p>
          )}
        </section>
      )}

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <TagEditor
            photoId={photo.id}
            src={photoSrc(photo.storage_key)}
            width={photo.width}
            height={photo.height}
            tags={(tags ?? []).map((tag) => ({
              id: tag.id,
              number: tag.label_number,
              x: tag.x,
              y: tag.y,
              personName: tag.person?.full_name ?? null,
            }))}
            people={personOptions}
          />
          {/* Same picture elsewhere (by image_hash): open it, compare and discard the worse one. */}
          <LookalikeList items={lookalikes.get(photo.id) ?? []} />
        </div>

        <form
          action={savePhoto}
          aria-label="Datos de la foto"
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="id" value={photo.id} />
          <PhotoDetailsFields values={photo} suggestions={suggestions} />
          <Field
            label="Publicación en Instagram (opcional)"
            name="instagram_url"
            type="url"
            value={photo.instagram_url}
            placeholder="https://www.instagram.com/p/…"
          />
          <label className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={photo.featured}
              className="size-4.5 accent-accent"
            />
            Destacar como foto de la semana
          </label>
          {currentFeatured && (
            <p className="-mt-2 text-xs text-muted">
              Ahora es la de{" "}
              <Link
                href={`/foto/${currentFeatured.slug}`}
                className="text-accent underline-offset-4 hover:underline"
              >
                {photoLabel(currentFeatured)}
              </Link>
              ; al marcar esta, la sustituye.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              name="intent"
              value="save"
              className="inline-flex h-12 items-center rounded-full border border-line-strong px-6 font-medium"
            >
              {published ? "Guardar cambios" : "Guardar borrador"}
            </button>
            {published && (
              <ConfirmButton
                label="Retirar foto"
                title="¿Retirar esta foto?"
                body="Dejará de verse en la web al momento. Las etiquetas, los recuerdos y el original se guardan, así que podrás volver a publicarla. Si había peticiones de retirada pendientes, se dan por resueltas."
                confirmLabel="Sí, retirarla"
                action={withdrawPhoto}
              />
            )}
            {publishable && (
              <button
                type="submit"
                name="intent"
                value="publish"
                className="inline-flex h-12 items-center rounded-full bg-accent px-6 font-semibold text-on-accent"
              >
                {photo.status === "withdrawn"
                  ? "Volver a publicar"
                  : "Publicar"}
              </button>
            )}
            {photo.status === "draft" && (
              <ConfirmButton
                label="Descartar"
                title="¿Descartar este borrador?"
                body="Deja de aparecer en borradores y no se publica."
                confirmLabel="Descartar"
                action={discardDrafts}
              />
            )}
          </div>
          {publishable && photo.status !== "withdrawn" && (
            <p className="text-xs text-muted">
              Al publicar, la foto aparece en el archivo y su dirección pasa a
              ser fija (equipo y temporada).
            </p>
          )}
        </form>
      </div>
    </main>
  );
}

// Who proposed it and what they said about it (the comment lives in the queue item).
async function loadProposal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  photoId: string,
  proposedBy: string,
) {
  const [{ data: profile }, { data: item }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", proposedBy)
      .maybeSingle(),
    supabase
      .from("review_items")
      .select("payload")
      .eq("photo_id", photoId)
      .eq("kind", "photo_proposal")
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    name: profile?.display_name ?? "un usuario",
    comment: item ? payloadText(item.payload, "comment") : null,
  };
}
