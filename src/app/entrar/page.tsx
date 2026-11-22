import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CodeForm } from "@/components/code-form";
import { CODE_ERRORS } from "@/lib/code-email";
import { getCurrentUser } from "@/lib/supabase/server";
import { sendMagicLink } from "./actions";

export const metadata: Metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  email: "Escribe un email válido.",
  espera:
    "Has hecho varios intentos seguidos. Espera un minuto y vuelve a intentarlo.",
  enlace:
    "El enlace no es válido o ha caducado. Pide uno nuevo: llega en unos segundos.",
  ...CODE_ERRORS,
};

export default async function SignInPage({
  searchParams,
}: PageProps<"/entrar">) {
  if (await getCurrentUser()) redirect("/");

  const params = await searchParams;
  const sent = params.enviado === "1";
  const error = typeof params.error === "string" ? ERRORS[params.error] : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide">
          Entrar
        </h1>
        <p className="text-muted">
          Sin contraseñas: te enviamos un enlace a tu email y entras con un
          toque.
        </p>
      </div>

      {sent ? (
        <div className="flex flex-col gap-6">
          <div
            role="status"
            className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-6"
          >
            <p className="font-semibold">Revisa tu correo</p>
            <p className="text-muted">
              Si ese email tiene cuenta, te acabamos de enviar un enlace para
              entrar. Mira también en la carpeta de spam. Si aún no tienes
              cuenta,{" "}
              <Link href="/registro" className="text-accent underline">
                pide acceso
              </Link>
              .
            </p>
            <Link href="/entrar" className="mt-2 w-fit text-accent underline">
              Usar otro email
            </Link>
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3"
            >
              {error}
            </p>
          )}
          <CodeForm next="/" retry="/entrar?enviado=1" />
        </div>
      ) : (
        <form action={sendMagicLink} className="flex flex-col gap-4">
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3"
            >
              {error}
            </p>
          )}
          <label htmlFor="email" className="font-semibold">
            Tu email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="nombre@ejemplo.com"
            className="min-h-11 rounded-xl border border-line-strong bg-surface px-4 text-fg placeholder:text-muted/70"
          />
          <button
            type="submit"
            className="min-h-11 rounded-full bg-accent px-6 font-semibold text-on-accent"
          >
            Enviarme el enlace
          </button>
          <p className="text-sm text-muted">
            ¿Aún no tienes cuenta? Se entra por invitación: cuando alguien te
            etiquete en una foto, te llegará un enlace. Si no,{" "}
            <Link href="/registro" className="text-accent underline">
              pide acceso
            </Link>
            .
          </p>
        </form>
      )}
    </main>
  );
}
