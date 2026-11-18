import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { requestAccess } from "./actions";

export const metadata: Metadata = { title: "Pide acceso" };

const ERRORS: Record<string, string> = {
  edad: "Para pedir acceso tienes que tener al menos 14 años.",
  nombre: "Escribe tu nombre.",
  email: "Escribe un email válido.",
  envio: "No se pudo enviar la solicitud. Inténtalo en un minuto.",
};

const FIELD =
  "min-h-11 rounded-xl border border-line-strong bg-surface px-4 text-fg placeholder:text-muted/70";

export default async function RequestAccessPage({
  searchParams,
}: PageProps<"/registro">) {
  if (await getCurrentUser()) redirect("/");

  const params = await searchParams;
  const sent = params.enviado === "1";
  const error = typeof params.error === "string" ? ERRORS[params.error] : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide">
          Pide acceso
        </h1>
        <p className="text-muted">
          Normalmente se entra cuando alguien te etiqueta en una foto y te manda
          la invitación. Si no es tu caso, déjanos tu nombre y un admin lo
          revisará.
        </p>
      </div>

      {sent ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-6"
        >
          <p className="font-semibold">Solicitud enviada</p>
          <p className="text-muted">
            Cuando un admin la apruebe, te llegará un email con un enlace para
            entrar. Puede tardar unos días; mira también en la carpeta de spam.
          </p>
          <Link href="/" className="mt-2 w-fit text-accent underline">
            Ver el archivo mientras tanto
          </Link>
        </div>
      ) : (
        <form action={requestAccess} className="flex flex-col gap-4">
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3"
            >
              {error}
            </p>
          )}
          <label htmlFor="name" className="font-semibold">
            Tu nombre
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={120}
            autoComplete="name"
            placeholder="Nombre y apellidos"
            aria-describedby="name-hint"
            className={FIELD}
          />
          <p id="name-hint" className="-mt-2 text-sm text-muted">
            Como te conocían en el equipo, para que te reconozcamos.
          </p>
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
            className={FIELD}
          />
          {/* Honeypot for bots: hidden from people and from screen readers. */}
          <div aria-hidden="true" className="absolute -left-[9999px]">
            <label>
              Web
              <input type="text" name="web" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="age"
              required
              className="mt-0.5 size-5 flex-none accent-accent"
            />
            <span>
              Tengo 14 años o más.{" "}
              <Link href="/privacidad" className="text-accent underline">
                Cómo tratamos tus datos
              </Link>
            </span>
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-full bg-accent px-6 font-semibold text-on-accent"
          >
            Pedir acceso
          </button>
          <p className="text-sm text-muted">
            ¿Ya tienes cuenta?{" "}
            <Link href="/entrar" className="text-accent underline">
              Entra
            </Link>
          </p>
        </form>
      )}
    </main>
  );
}
