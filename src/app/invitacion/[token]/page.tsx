import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { FaceCrop } from "@/components/face-crop";
import { INVITATION_ERRORS } from "@/lib/invitations";
import { photoSrc } from "@/lib/photos";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  acceptInvitation,
  disputeInvitation,
  requestInvitationLink,
} from "../actions";

// Arrives from a WhatsApp link. Steps (?paso=): ask → email → enviado, or no-soy-yo → gracias.
// Signed in: a single «Sí, soy yo» confirmation.
export const metadata: Metadata = {
  title: "¿Eres tú?",
  robots: { index: false },
};

export default async function InvitationPage({
  params,
  searchParams,
}: PageProps<"/invitacion/[token]">) {
  const { token } = await params;
  const { paso, error } = await searchParams;
  const step = typeof paso === "string" ? paso : "";
  const problem =
    typeof error === "string" ? INVITATION_ERRORS[error] : undefined;

  const supabase = await createClient();
  const [{ data: invitation }, user] = await Promise.all([
    supabase.rpc("invitation_preview", { p_token: token }).maybeSingle(),
    getCurrentUser(),
  ]);
  if (!invitation) notFound();

  const firstName = invitation.person_name?.split(" ")[0] ?? "";
  const inviter = invitation.inviter_name ?? "Alguien";
  const photoLabel = [
    invitation.photo_team,
    invitation.photo_season && `temporada ${invitation.photo_season}`,
  ]
    .filter(Boolean)
    .join(", ");

  if (invitation.status !== "valid") {
    return (
      <Card>
        <h1 className={TITLE}>
          {invitation.status === "accepted"
            ? "Esta invitación ya se ha usado"
            : "Esta invitación ha caducado"}
        </h1>
        <p className="text-muted">
          {invitation.status === "accepted"
            ? "Si es tuya, entra con tu email."
            : `Pide a ${inviter} que te mande un enlace nuevo.`}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/entrar" className={PRIMARY}>
            Entrar
          </Link>
          {invitation.person_slug && (
            <Link
              href={`/persona/${invitation.person_slug}`}
              className={SECONDARY}
            >
              Ver la página de {invitation.person_name}
            </Link>
          )}
        </div>
      </Card>
    );
  }

  // Signed in (usually right after the magic link): confirm and link.
  if (user && step !== "gracias") {
    const { data: own } = await supabase
      .from("people")
      .select("slug")
      .eq("claimed_by", user.id)
      .maybeSingle();
    if (own && own.slug === invitation.person_slug) {
      redirect(`/persona/${own.slug}`);
    }
    return (
      <Card photo={<Photo invitation={invitation} name={firstName} />}>
        <h1 className={TITLE}>
          {invitation.person_name
            ? `¿Eres tú, ${firstName}?`
            : "Te han invitado como admin"}
        </h1>
        {problem && <Problem>{problem}</Problem>}
        <form action={acceptInvitation} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />
          <Consent />
          <button type="submit" className={PRIMARY}>
            {invitation.person_name ? "Sí, soy yo" : "Aceptar"}
          </button>
        </form>
        {invitation.person_name && (
          <Link href="?paso=no-soy-yo" className={LINK}>
            No soy yo
          </Link>
        )}
      </Card>
    );
  }

  if (step === "email") {
    return (
      <Card>
        <h1 className={TITLE}>Entra con tu email</h1>
        <p className="text-muted">
          Te mandamos un enlace para entrar. No hace falta recordar ninguna
          contraseña.
        </p>
        {problem && <Problem>{problem}</Problem>}
        <form action={requestInvitationLink} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />
          <label className="flex flex-col gap-1.5 text-sm text-muted">
            Tu email
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="nombre@correo.com"
              className="h-12 rounded-lg border border-line-strong bg-[#1a1a1a] px-3 text-base text-fg"
            />
          </label>
          <Consent />
          <button type="submit" className={PRIMARY}>
            Enviarme el enlace
          </button>
        </form>
        <Link href="?" className={LINK}>
          ← Volver
        </Link>
      </Card>
    );
  }

  if (step === "enviado") {
    return (
      <Card>
        <h1 className={TITLE}>Mira tu correo</h1>
        <p className="text-muted">
          Te hemos enviado un enlace para entrar. Ábrelo desde este móvil y
          confirma que eres tú. Puede tardar un par de minutos; mira también en
          la carpeta de spam.
        </p>
        <Link href="?paso=email" className={SECONDARY}>
          No me ha llegado, usar otro email
        </Link>
      </Card>
    );
  }

  if (step === "no-soy-yo") {
    return (
      <Card>
        <h1 className={TITLE}>Gracias por avisar</h1>
        <p className="text-muted">
          Le diremos al archivo que esa etiqueta está mal. Si sabes quién es,
          nos ayudas mucho.
        </p>
        <form action={disputeInvitation} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />
          <label className="flex flex-col gap-1.5 text-sm text-muted">
            ¿Quién es? (opcional)
            <input
              type="text"
              name="name"
              maxLength={200}
              placeholder="Nombre y apellidos"
              className="h-12 rounded-lg border border-line-strong bg-[#1a1a1a] px-3 text-base text-fg"
            />
          </label>
          <button type="submit" className={PRIMARY}>
            Enviar
          </button>
        </form>
        <Link href="/" className={LINK}>
          Ver el archivo igualmente
        </Link>
      </Card>
    );
  }

  if (step === "gracias") {
    return (
      <Card>
        <h1 className={TITLE}>¡Gracias!</h1>
        <p className="text-muted">
          Lo revisaremos. Mientras tanto, echa un vistazo al archivo: quizá
          encuentres a alguien que conoces.
        </p>
        <Link href="/" className={PRIMARY}>
          Ver el archivo
        </Link>
      </Card>
    );
  }

  // First screen.
  return (
    <Card photo={<Photo invitation={invitation} name={firstName} />}>
      <p className="text-muted">
        {inviter} te ha etiquetado en una foto
        {photoLabel ? ` de ${photoLabel}` : ""}.
      </p>
      <h1 className={TITLE}>
        {invitation.person_name
          ? `¿Eres tú, ${firstName}?`
          : "Te han invitado al archivo"}
      </h1>
      <p className="text-muted">
        Si eres tú, entra para ver todas tus fotos, añadir recuerdos y etiquetar
        a tus compañeros. Sin contraseñas.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="?paso=email" className={PRIMARY}>
          Sí, soy yo
        </Link>
        {invitation.person_name && (
          <Link href="?paso=no-soy-yo" className={SECONDARY}>
            No soy yo
          </Link>
        )}
      </div>
    </Card>
  );
}

const TITLE = "font-display text-[40px] leading-none font-bold";
const PRIMARY =
  "inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 font-semibold text-on-accent";
const SECONDARY =
  "inline-flex h-12 items-center justify-center rounded-full border border-line-strong px-6 font-medium";
const LINK = "inline-flex min-h-11 items-center text-sm text-muted underline";

function Card({ children, photo }: { children: ReactNode; photo?: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-6">
      {photo}
      {children}
    </main>
  );
}

function Problem({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-accent px-4 py-3 text-sm"
    >
      {children}
    </p>
  );
}

function Consent() {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        name="consent"
        required
        className="mt-0.5 size-5 flex-none accent-accent"
      />
      Acepto que mi nombre aparezca en las fotos en las que me etiqueten. Puedo
      quitar mis etiquetas cuando quiera.
    </label>
  );
}

function Photo({
  invitation,
  name,
}: {
  invitation: {
    photo_storage_key: string | null;
    tag_x: number | null;
    tag_y: number | null;
  };
  name: string;
}) {
  if (
    !invitation.photo_storage_key ||
    invitation.tag_x === null ||
    invitation.tag_y === null
  ) {
    return null;
  }
  return (
    <FaceCrop
      src={photoSrc(invitation.photo_storage_key)}
      x={invitation.tag_x}
      y={invitation.tag_y}
      alt={`La cara etiquetada como ${name}`}
      className="aspect-square w-full rounded-lg"
    >
      <span className="absolute bottom-3 left-3 rounded-md bg-accent px-2.5 py-1 text-sm font-semibold text-on-accent">
        ¿{name}?
      </span>
    </FaceCrop>
  );
}
