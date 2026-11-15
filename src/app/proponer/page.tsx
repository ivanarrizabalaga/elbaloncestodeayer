import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PhotoUploader } from "@/components/photo-uploader";
import { photoLabel, photoSrc } from "@/lib/photos";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { WithdrawOwnPhoto } from "@/components/withdraw-own-photo";
import { finishProposal, startProposal } from "./actions";

export const metadata: Metadata = { title: "Proponer fotos" };

const STATUS: Record<string, string> = {
  proposed: "Pendiente de revisar",
  draft: "Pendiente de revisar",
  published: "Publicada",
  rejected: "No se ha publicado",
  withdrawn: "Retirada",
};

const NOTICES: Record<string, string> = {
  borrada: "Foto borrada. No queda nada de ella en el archivo.",
  retirada:
    "Foto retirada. Ya no se ve en la web; las etiquetas y los recuerdos se guardan ocultos.",
  error: "No se pudo retirar la foto. Inténtalo otra vez.",
};

export default async function ProposePage({
  searchParams,
}: PageProps<"/proponer">) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  if (user.isAdmin) redirect("/admin/subir");
  const { retirada } = await searchParams;
  const notice = typeof retirada === "string" ? NOTICES[retirada] : undefined;

  const supabase = await createClient();
  const { data: photos } = await supabase
    .from("photos")
    .select("id, slug, status, team, season_label, storage_key, created_at")
    .eq("proposed_by", user.id)
    .order("created_at", { ascending: false });

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
          role={retirada === "error" ? "alert" : "status"}
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
          comment={{
            label: "¿Qué sabes de estas fotos? (opcional)",
            placeholder:
              "Equipo, temporada, dónde se hizo, quién sale, de quién es la foto…",
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
        {!photos?.length ? (
          <p className="text-muted">Todavía no has propuesto ninguna.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {photos.map((photo) => (
              <li
                key={photo.id}
                className="flex items-start gap-4 rounded-lg bg-surface p-3"
              >
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
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-medium">
                    {photo.status === "published" ? (
                      <Link
                        href={`/foto/${photo.slug}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {photoLabel(photo)}
                      </Link>
                    ) : (
                      (photo.team ?? "Foto propuesta")
                    )}
                  </span>
                  <span
                    className={`text-sm ${photo.status === "published" ? "text-accent" : "text-muted"}`}
                  >
                    {STATUS[photo.status] ?? photo.status}
                  </span>
                  {photo.status !== "withdrawn" &&
                    photo.status !== "rejected" && (
                      <WithdrawOwnPhoto
                        id={photo.id}
                        published={photo.status === "published"}
                      />
                    )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
