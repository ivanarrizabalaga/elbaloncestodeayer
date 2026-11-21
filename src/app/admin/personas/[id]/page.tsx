import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { loadPersonOptions } from "@/lib/people";
import { createClient } from "@/lib/supabase/server";
import { mergePerson, savePerson } from "../actions";
import { MergePicker } from "./merge-picker";

export const metadata: Metadata = { title: "Editar persona" };

const MESSAGES: Record<string, string> = {
  guardada: "Cambios guardados.",
  fusionada: "Personas fusionadas. Esta es la que se queda.",
};
const ERRORS: Record<string, string> = {
  datos: "El nombre no puede estar vacío.",
  guardar: "No se pudieron guardar los cambios.",
  cuentas:
    "Las dos personas tienen cuenta, así que no se pueden fusionar: cada cuenta va con una sola persona.",
  fusionar: "No se pudo fusionar. Recarga y vuelve a probar.",
};

const INPUT =
  "rounded-lg border border-line-strong bg-[#1a1a1a] px-3 text-base text-fg";

export default async function EditPersonPage({
  params,
  searchParams,
}: PageProps<"/admin/personas/[id]">) {
  const { id } = await params;
  const { ok, error } = await searchParams;
  const supabase = await createClient();

  const { data: person } = await supabase
    .from("people")
    .select("id, full_name, slug, bio, claimed_by, merged_into")
    .eq("id", id)
    .maybeSingle();
  if (!person) notFound();
  // An old link to a merged duplicate opens the person it was merged into.
  if (person.merged_into) redirect(`/admin/personas/${person.merged_into}`);

  const [{ data: tags }, { data: account }, options] = await Promise.all([
    supabase
      .from("tags")
      .select("photo_id")
      .eq("person_id", id)
      .is("removed_at", null),
    person.claimed_by
      ? supabase
          .from("profiles")
          .select("display_name, role")
          .eq("id", person.claimed_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    loadPersonOptions(supabase),
  ]);
  const photos = new Set((tags ?? []).map((t) => t.photo_id)).size;
  const message = typeof ok === "string" ? MESSAGES[ok] : undefined;
  const problem = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-8 sm:px-6">
      <div className="flex flex-col gap-1">
        <BackLink
          fallback="/admin/personas"
          className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          ← Volver
        </BackLink>
        <h1 className="font-display text-[40px] leading-none font-bold">
          {person.full_name}
        </h1>
        <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted">
          <span>
            {photos} {photos === 1 ? "foto" : "fotos"} ·{" "}
            {account ? (
              <>
                Tiene cuenta:{" "}
                <Link
                  href={
                    account.role === "admin"
                      ? "/admin/usuarios"
                      : `/admin/usuarios?lista=usuarios&q=${encodeURIComponent(account.display_name ?? "")}`
                  }
                  className="text-accent underline-offset-4 hover:underline"
                >
                  {account.display_name ?? "ver su cuenta"}
                </Link>
              </>
            ) : (
              "Aún no tiene cuenta"
            )}
          </span>
          <Link
            href={`/persona/${person.slug}`}
            className="inline-flex min-h-11 items-center text-accent"
          >
            Ver en la web →
          </Link>
        </p>
      </div>

      {(message || problem) && (
        <p
          role={problem ? "alert" : "status"}
          className={`rounded-lg px-4 py-3 text-sm ${problem ? "border border-accent" : "bg-surface-2"}`}
        >
          {problem ?? message}
        </p>
      )}

      <form
        action={savePerson}
        aria-label="Datos de la persona"
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="id" value={person.id} />
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Nombre y apellidos
          <input
            type="text"
            name="full_name"
            required
            maxLength={200}
            defaultValue={person.full_name}
            className={`h-11 ${INPUT}`}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Sobre esta persona (opcional)
          <textarea
            name="bio"
            rows={4}
            maxLength={2000}
            defaultValue={person.bio ?? ""}
            placeholder="Equipos, posición, años en los que jugó…"
            className={`py-2 ${INPUT}`}
          />
        </label>
        <p className="-mt-2 text-xs text-muted">
          El enlace de su página (/persona/{person.slug}) no cambia, para que
          los que ya se han compartido sigan funcionando.
        </p>
        <button
          type="submit"
          className="inline-flex h-12 w-fit items-center rounded-full bg-accent px-6 font-semibold text-on-accent"
        >
          Guardar cambios
        </button>
      </form>

      <section
        aria-labelledby="fusionar"
        className="flex flex-col gap-3 border-t border-line pt-6"
      >
        <h2 id="fusionar" className="font-display text-2xl font-bold">
          ¿Está duplicada?
        </h2>
        <p className="text-sm text-muted">
          Si esta persona ya está en el archivo con otro nombre (por ejemplo,
          «Pepe Garcia» y «Pepe García»), fusiónala con la que se queda. Sus
          etiquetas, invitaciones y cuenta pasan a la otra, y su página lleva a
          la de la otra.
        </p>
        <MergePicker
          personId={person.id}
          personName={person.full_name}
          people={options.filter((o) => o.id !== person.id)}
          action={mergePerson}
        />
      </section>
    </main>
  );
}
