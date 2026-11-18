import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { PhotoDetailsFields } from "@/components/photo-details-fields";
import { PhotoUploader } from "@/components/photo-uploader";
import { loadDetailSuggestions } from "@/lib/photo-details";
import { photoLabel, photoSrc } from "@/lib/photos";
import { CONTACT_EMAIL } from "@/lib/site";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import { finishProposal, startProposal, withdrawOwnPhoto } from "./actions";

export const metadata: Metadata = { title: "Proponer fotos" };

// «Tus fotos»: one list, pending first, each with a status pill. [label, pill style, order]
const STATUS: Record<string, [string, string, number]> = {
  proposed: ["Pendiente", "bg-surface-3 text-muted", 0],
  draft: ["Pendiente", "bg-surface-3 text-muted", 0],
  published: ["Publicada", "bg-surface-3 text-accent", 1],
  rejected: ["No publicada", "border border-line-strong text-muted", 2],
  withdrawn: ["Retirada", "border border-line-strong text-muted", 3],
};

const BUTTON =
  "inline-flex h-11 items-center rounded-full border border-line-strong px-4 text-[13px] font-semibold";

const NOTICES: Record<string, string> = {
  borrada: "Foto borrada. No queda nada de ella en el archivo.",
  retirada:
    "Foto retirada. Ya no se ve en la web; las etiquetas y los recuerdos se guardan ocultos.",
  error: "No se pudo retirar la foto. Inténtalo otra vez.",
  datos: "Datos guardados. Un admin los revisará al publicar la foto.",
};

export default async function ProposePage({
  searchParams,
}: PageProps<"/proponer">) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  if (user.isAdmin) redirect("/admin/subir");
  const { aviso } = await searchParams;
  const notice = typeof aviso === "string" ? NOTICES[aviso] : undefined;

  const supabase = await createClient();
  const [{ data: photos }, suggestions] = await Promise.all([
    supabase
      .from("photos")
      .select(
        "id, slug, status, team, season_label, storage_key, source_file, created_at",
      )
      .eq("proposed_by", user.id)
      .order("created_at", { ascending: false }),
    loadDetailSuggestions(supabase),
  ]);
  const sorted = (photos ?? []).sort(
    (a, b) => (STATUS[a.status]?.[2] ?? 9) - (STATUS[b.status]?.[2] ?? 9),
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 pt-8 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[40px] leading-none font-bold">
          Proponer fotos
        </h1>
        <p className="text-muted">
          ¿Tienes fotos de aquellos años? Súbelas y un admin las revisará antes
          de publicarlas. Siguen siendo tuyas: puedes retirarlas cuando quieras.
        </p>
      </div>

      {notice && (
        <p
          role={aviso === "error" ? "alert" : "status"}
          className="rounded-lg bg-surface-2 px-4 py-3"
        >
          {notice}
        </p>
      )}

      {user.isBlocked ? (
        <p className="rounded-lg border border-accent px-4 py-3">
          Tu cuenta no puede proponer fotos. Sí puedes retirar las que ya
          aportaste.
        </p>
      ) : (
        <PhotoUploader
          start={startProposal}
          finish={finishProposal}
          doneLabel="Enviada: la revisaremos pronto"
          similarLabel="Parece que ya está en el archivo (si es la misma, puedes retirarla abajo):"
          details={<PhotoDetailsFields suggestions={suggestions} />}
          comment={{
            label: "Algo más para los admins (opcional)",
            placeholder:
              "Quién sale, cualquier cosa que no encaje en los datos…",
          }}
          confirm="Las fotos son mías o tengo permiso para compartirlas, no sale nadie que hoy sea menor de edad (salvo con permiso de sus padres) y acepto que se publiquen en el archivo."
        />
      )}

      <section aria-labelledby="tus-fotos" className="flex flex-col gap-4">
        <h2
          id="tus-fotos"
          className="font-display text-[30px] leading-none font-bold"
        >
          Tus fotos
        </h2>
        {sorted.length === 0 ? (
          <p className="text-muted">Todavía no has propuesto ninguna.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sorted.map((photo) => (
              <OwnPhoto key={photo.id} photo={photo} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

type Own = {
  id: string;
  slug: string;
  status: string;
  team: string | null;
  season_label: string | null;
  storage_key: string | null;
  source_file: string | null;
  created_at: string;
};

function OwnPhoto({ photo }: { photo: Own }) {
  const [label, pill] = STATUS[photo.status] ?? [photo.status, "", 9];
  // Team and season when an admin has filled them in; otherwise the uploaded file's name.
  const title = photo.team
    ? photoLabel(photo)
    : (photo.source_file ?? "Foto sin datos");

  // «hace 3 días», «ayer» or, after a month, «el 12 nov 2026».
  const ago = timeAgo(photo.created_at);
  const uploaded = /^\d/.test(ago) ? `el ${ago}` : ago;

  let actions: ReactNode = null;
  if (photo.status === "published") {
    actions = (
      <>
        <Link href={`/foto/${photo.slug}`} className={BUTTON}>
          Ver foto
        </Link>
        <ConfirmButton
          compact
          label="Retirar"
          title="¿Retirar esta foto?"
          body="Dejará de verse en la web al momento. Las etiquetas y los recuerdos de otros se guardan, ocultos."
          confirmLabel="Sí, retirarla"
          action={withdrawOwnPhoto}
        />
      </>
    );
  } else if (photo.status === "proposed") {
    actions = (
      <>
        <Link href={`/proponer/${photo.id}`} className={BUTTON}>
          {photo.team || photo.season_label ? "Editar datos" : "Añadir datos"}
        </Link>
        <ConfirmButton
          compact
          label="Retirar"
          title="¿Retirar esta foto?"
          body="Se borrará del todo, sin pasar por revisión."
          confirmLabel="Sí, retirarla"
          action={withdrawOwnPhoto}
        />
      </>
    );
  } else if (photo.status === "draft") {
    actions = (
      <ConfirmButton
        compact
        label="Retirar"
        title="¿Retirar esta foto?"
        body="Se borrará del todo, sin pasar por revisión."
        confirmLabel="Sí, retirarla"
        action={withdrawOwnPhoto}
      />
    );
  } else if (photo.status === "rejected") {
    // The files are already gone: this only removes the row.
    actions = (
      <button type="submit" formAction={withdrawOwnPhoto} className={BUTTON}>
        Quitar de la lista
      </button>
    );
  }

  return (
    <li className="flex gap-3 rounded-lg bg-surface p-3">
      {photo.storage_key ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoSrc(photo.storage_key, "thumb")}
          alt=""
          className="h-[66px] w-[88px] flex-none rounded-md object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="h-[66px] w-[88px] flex-none rounded-md bg-surface-3"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-medium" title={title}>
            {title}
          </span>
          <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${pill}`}
            >
              {label}
            </span>
            Subida {uploaded}
          </span>
          {photo.status === "rejected" && (
            <p className="text-sm text-muted">
              Puede que estuviera repetida o que no encajara en el archivo. Si
              tienes dudas, escríbenos a{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-accent underline"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          )}
        </div>
        {actions && (
          <form className="flex flex-none flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={photo.id} />
            {actions}
          </form>
        )}
      </div>
    </li>
  );
}
