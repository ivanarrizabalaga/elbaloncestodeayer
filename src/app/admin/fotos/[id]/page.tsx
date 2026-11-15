import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPersonOptions } from "@/lib/people";
import { photoSrc } from "@/lib/photos";
import { payloadText } from "@/lib/review";
import { createClient } from "@/lib/supabase/server";
import { savePhoto } from "./actions";
import { TagEditor } from "./tag-editor";

export const metadata: Metadata = { title: "Editar foto" };

const MESSAGES: Record<string, string> = {
  guardada: "Cambios guardados.",
  publicada: "Foto publicada.",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  proposed: "Propuesta",
  published: "Publicada",
  withdrawn: "Retirada",
  rejected: "Rechazada",
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

  const [{ data: tags }, personOptions, { data: values }] = await Promise.all([
    supabase
      .from("tags")
      .select("id, x, y, label_number, person:people(full_name)")
      .eq("photo_id", id)
      .is("removed_at", null)
      .order("label_number"),
    loadPersonOptions(supabase),
    // Existing values, offered as suggestions so the same team is not spelt five ways.
    supabase.from("photos").select("team, venue, competition, provenance"),
  ]);

  const suggestions = (key: "team" | "venue" | "competition" | "provenance") =>
    [...new Set((values ?? []).flatMap((v) => (v[key] ? [v[key]] : [])))].sort(
      (a, b) => a.localeCompare(b, "es"),
    );

  const published = photo.status === "published";
  // Drafts and user proposals can be published; withdrawn photos stay down (SPEC §5).
  const publishable = photo.status === "draft" || photo.status === "proposed";
  const proposal = photo.proposed_by
    ? await loadProposal(supabase, photo.id, photo.proposed_by)
    : null;
  const message = typeof ok === "string" ? MESSAGES[ok] : undefined;
  const problem = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link
            href="/admin/subir"
            className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
          >
            ← Subir fotos y borradores
          </Link>
          <h1 className="font-display text-[40px] leading-none font-bold">
            {published ? "Editar foto" : "Etiquetar y publicar"}
          </h1>
        </div>
        <span className="flex items-center gap-3 text-sm">
          <span
            className={`rounded-full px-3 py-1 font-semibold ${published ? "bg-accent text-on-accent" : "border border-line-strong"}`}
          >
            {STATUS_LABEL[photo.status]}
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

        <form
          action={savePhoto}
          aria-label="Datos de la foto"
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="id" value={photo.id} />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Temporada o año"
              name="season_label"
              value={photo.season_label}
              placeholder="1984–85"
            />
            <Field
              label="Equipo"
              name="team"
              value={photo.team}
              list={suggestions("team")}
            />
            <Field
              label="Pabellón"
              name="venue"
              value={photo.venue}
              list={suggestions("venue")}
            />
            <Field
              label="Competición"
              name="competition"
              value={photo.competition}
              placeholder="Liga, torneo…"
              list={suggestions("competition")}
            />
          </div>
          <Field
            label="Procedencia"
            name="provenance"
            value={photo.provenance}
            placeholder="Colección de…, aportada por…"
            list={suggestions("provenance")}
          />
          <Field
            label="Autor de la foto (si se sabe)"
            name="photographer"
            value={photo.photographer}
          />
          <label className="flex flex-col gap-1.5 text-sm text-muted">
            La historia
            <textarea
              name="story"
              rows={5}
              defaultValue={photo.story ?? ""}
              placeholder="El partido, la temporada, alguna anécdota…"
              className="rounded-lg border border-line-strong bg-[#1a1a1a] px-3 py-2 text-base text-fg"
            />
          </label>
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

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              name="intent"
              value="save"
              className="inline-flex h-12 items-center rounded-full border border-line-strong px-6 font-medium"
            >
              {published ? "Guardar cambios" : "Guardar borrador"}
            </button>
            {publishable && (
              <button
                type="submit"
                name="intent"
                value="publish"
                className="inline-flex h-12 items-center rounded-full bg-accent px-6 font-semibold text-on-accent"
              >
                Publicar
              </button>
            )}
          </div>
          {publishable && (
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

function Field({
  label,
  name,
  value,
  placeholder,
  type = "text",
  list,
}: {
  label: string;
  name: string;
  value: string | null;
  placeholder?: string;
  type?: string;
  list?: string[];
}) {
  const listId = list?.length ? `${name}-options` : undefined;
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm text-muted">
      {label}
      <input
        type={type}
        name={name}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        list={listId}
        className="h-11 min-w-0 rounded-lg border border-line-strong bg-[#1a1a1a] px-3 text-base text-fg"
      />
      {listId && (
        <datalist id={listId}>
          {list!.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </label>
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
