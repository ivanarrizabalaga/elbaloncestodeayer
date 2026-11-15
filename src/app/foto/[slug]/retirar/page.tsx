import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WithdrawOwnPhoto } from "@/components/withdraw-own-photo";
import { photoLabel, photoSrc } from "@/lib/photos";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { requestRemoval } from "./actions";

export const metadata: Metadata = {
  title: "Pedir que se retire una foto",
  robots: { index: false },
};

const ERRORS: Record<string, string> = {
  motivo: "Cuéntanos por qué quieres que se retire.",
  enviar: "No se pudo enviar. Inténtalo otra vez.",
};

export default async function RemovalRequestPage({
  params,
  searchParams,
}: PageProps<"/foto/[slug]/retirar">) {
  const { slug } = await params;
  const { enviado, error } = await searchParams;
  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("photos")
    .select("id, slug, team, season_label, storage_key, proposed_by")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!photo?.storage_key) notFound();

  const user = await getCurrentUser();
  const isOwner = user !== null && photo.proposed_by === user.id;
  const problem = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-8 sm:px-6">
      <Link
        href={`/foto/${photo.slug}`}
        className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
      >
        ← Volver a la foto
      </Link>
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoSrc(photo.storage_key, "thumb")}
          alt={`Foto: ${photoLabel(photo)}`}
          className="h-[90px] w-[120px] flex-none rounded-md object-cover"
        />
        <h1 className="font-display text-[32px] leading-none font-bold">
          Pedir que se retire esta foto
        </h1>
      </div>

      {enviado ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-lg bg-surface-2 p-4"
        >
          <p className="font-semibold">Recibido. Gracias por avisar.</p>
          <p className="text-muted">
            Las peticiones de retirada son lo primero que revisamos. Si nos has
            dejado un contacto, te escribiremos.
          </p>
        </div>
      ) : isOwner ? (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-4">
          <p>
            Esta foto la aportaste tú, así que puedes retirarla directamente,
            sin esperar a nadie.
          </p>
          <WithdrawOwnPhoto id={photo.id} published />
        </div>
      ) : (
        <form action={requestRemoval} className="flex flex-col gap-4">
          <p className="text-muted">
            Si sales en ella, es tuya o hay cualquier otro motivo, cuéntanoslo.
            Un admin lo revisará con prioridad.
          </p>
          {problem && (
            <p
              role="alert"
              className="rounded-lg border border-accent px-4 py-3"
            >
              {problem}
            </p>
          )}
          <input type="hidden" name="slug" value={photo.slug} />
          <label className="flex flex-col gap-2 text-sm text-muted">
            ¿Por qué quieres que se retire?
            <textarea
              name="reason"
              required
              rows={4}
              maxLength={2000}
              className="rounded-lg border border-line-strong bg-[#1a1a1a] px-3.5 py-3 text-[15px] text-fg"
            />
          </label>
          {!user && (
            <label className="flex flex-col gap-2 text-sm text-muted">
              Tu nombre (opcional)
              <input
                name="name"
                maxLength={200}
                autoComplete="name"
                className="h-11 rounded-lg border border-line-strong bg-[#1a1a1a] px-3.5 text-[15px] text-fg"
              />
            </label>
          )}
          <label className="flex flex-col gap-2 text-sm text-muted">
            Un email o teléfono para responderte (opcional)
            <input
              name="contact"
              maxLength={200}
              className="h-11 rounded-lg border border-line-strong bg-[#1a1a1a] px-3.5 text-[15px] text-fg"
            />
            <span className="text-xs">
              Solo lo verán los admins, y solo para contestarte.
            </span>
          </label>
          <button
            type="submit"
            className="inline-flex h-11 items-center self-start rounded-full bg-accent px-5 font-semibold text-on-accent"
          >
            Enviar petición
          </button>
        </form>
      )}
    </main>
  );
}
