import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { signOut } from "@/app/entrar/actions";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { deleteAccount, updateName } from "./actions";

export const metadata: Metadata = {
  title: "Mi cuenta",
  robots: { index: false },
};

const ERRORS: Record<string, string> = {
  nombre: "Escribe un nombre.",
  guardar: "No se pudo guardar. Inténtalo otra vez.",
  ultimo:
    "Eres el último admin: antes de borrar tu cuenta, haz admin a otra persona.",
  borrar: "No se pudo borrar la cuenta. Inténtalo otra vez.",
};

const CARD = "flex flex-col gap-3 rounded-lg bg-surface p-5";
const H2 = "font-display text-[26px] leading-none font-bold";

export default async function AccountPage({
  searchParams,
}: PageProps<"/cuenta">) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const { ok, error } = await searchParams;
  const problem = typeof error === "string" ? ERRORS[error] : undefined;

  const supabase = await createClient();
  const [{ data: person }, { count: publishedPhotos }] = await Promise.all([
    supabase
      .from("people")
      .select("full_name, slug")
      .eq("claimed_by", user.id)
      .maybeSingle(),
    supabase
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("proposed_by", user.id)
      .eq("status", "published"),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-8 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[40px] leading-none font-bold">
          Mi cuenta
        </h1>
        <p className="text-muted">Has entrado como {user.email}.</p>
      </div>

      {(problem || ok === "nombre") && (
        <p
          role={problem ? "alert" : "status"}
          className={`rounded-lg px-4 py-3 ${problem ? "border border-accent" : "bg-surface-2"}`}
        >
          {problem ?? "Nombre guardado."}
        </p>
      )}

      <section aria-labelledby="nombre" className={CARD}>
        <h2 id="nombre" className={H2}>
          Tu nombre
        </h2>
        <form action={updateName} className="flex flex-col gap-3">
          <label className="flex flex-col gap-2 text-sm text-muted">
            Es el que aparece junto a tus recuerdos. Tu email no se muestra
            nunca.
            <input
              name="name"
              required
              maxLength={80}
              autoComplete="name"
              defaultValue={user.displayName ?? ""}
              className="h-11 rounded-lg border border-line-strong bg-[#1a1a1a] px-3.5 text-[15px] text-fg"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-11 items-center self-start rounded-full bg-accent px-5 font-semibold text-on-accent"
          >
            Guardar
          </button>
        </form>
      </section>

      <section aria-labelledby="archivo" className={CARD}>
        <h2 id="archivo" className={H2}>
          En el archivo
        </h2>
        {person ? (
          <p>
            Tu cuenta está enlazada con{" "}
            <Link
              href={`/persona/${person.slug}`}
              className="text-accent underline-offset-4 hover:underline"
            >
              {person.full_name}
            </Link>
            . Desde las fotos puedes quitar tus etiquetas cuando quieras.
          </p>
        ) : (
          <p className="text-muted">
            Tu cuenta no está enlazada con nadie del archivo. Si sales en alguna
            foto, abre tu página y pulsa «Este soy yo».
          </p>
        )}
        {!user.isAdmin && (
          <Link
            href="/proponer"
            className="text-accent underline-offset-4 hover:underline"
          >
            Tus fotos propuestas →
          </Link>
        )}
      </section>

      <section aria-labelledby="salir" className={CARD}>
        <h2 id="salir" className={H2}>
          Salir o irte
        </h2>
        <p className="text-sm text-muted">
          Si borras tu cuenta, se borran tus recuerdos y las fotos que
          propusiste y no se llegaron a publicar, y tu persona del archivo queda
          libre. Las etiquetas que pusiste se quedan, sin tu nombre, porque
          describen la foto.
          {publishedPhotos === 1 &&
            " Tu foto publicada también se queda; si quieres que desaparezca, retírala antes desde «Tus fotos propuestas»."}
          {publishedPhotos && publishedPhotos > 1
            ? ` Tus ${publishedPhotos} fotos publicadas también se quedan; si quieres que desaparezcan, retíralas antes desde «Tus fotos propuestas».`
            : ""}{" "}
          No se puede deshacer.
        </p>
        <form className="flex flex-wrap gap-3">
          <button
            type="submit"
            formAction={signOut}
            className="inline-flex h-12 items-center rounded-full border border-line-strong px-6 font-semibold"
          >
            Salir
          </button>
          <ConfirmButton
            label="Borrar mi cuenta"
            title="¿Borrar tu cuenta?"
            body="Se borran tus recuerdos y tus fotos sin publicar, y tu persona queda libre. No se puede deshacer."
            confirmLabel="Sí, borrar mi cuenta"
            action={deleteAccount}
          />
        </form>
      </section>
    </main>
  );
}
