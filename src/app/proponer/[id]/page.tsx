import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PhotoDetailsFields } from "@/components/photo-details-fields";
import { loadDetailSuggestions } from "@/lib/photo-details";
import { photoSrc } from "@/lib/photos";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { UUID } from "@/lib/uploads";
import { saveOwnProposal } from "../actions";

export const metadata: Metadata = {
  title: "Datos de tu foto",
  robots: { index: false },
};

// The proposer fills in the details of a photo while it waits for review (SPEC §5).
export default async function OwnProposalPage({
  params,
  searchParams,
}: PageProps<"/proponer/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const { id } = await params;
  const { error } = await searchParams;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: photo }, suggestions] = await Promise.all([
    supabase
      .from("photos")
      .select(
        "id, status, storage_key, width, height, source_file, season_label, team, venue, competition, provenance, photographer, story",
      )
      .eq("id", id)
      .eq("proposed_by", user.id)
      .maybeSingle(),
    loadDetailSuggestions(supabase),
  ]);
  if (!photo) notFound();
  // Once reviewed, the details belong to the archive.
  if (photo.status !== "proposed") redirect("/proponer");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-8 sm:px-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/proponer"
          className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          ← Tus fotos
        </Link>
        <h1 className="font-display text-[40px] leading-none font-bold">
          Datos de tu foto
        </h1>
        <p className="text-muted">
          Tú eres quien mejor la conoce. Rellena lo que sepas y deja en blanco
          el resto; un admin lo revisará antes de publicarla.
        </p>
      </div>

      {photo.storage_key && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoSrc(photo.storage_key)}
          alt={photo.source_file ?? "Tu foto"}
          width={photo.width ?? undefined}
          height={photo.height ?? undefined}
          className="h-auto max-h-[60vh] w-full rounded-lg bg-surface object-contain"
        />
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-accent px-4 py-3">
          No se pudieron guardar los datos. Puede que un admin ya la haya
          revisado.
        </p>
      )}

      <form action={saveOwnProposal} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={photo.id} />
        <PhotoDetailsFields values={photo} suggestions={suggestions} />
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="inline-flex h-12 items-center rounded-full bg-accent px-6 font-semibold text-on-accent"
          >
            Guardar
          </button>
          <Link
            href="/proponer"
            className="inline-flex h-12 items-center rounded-full border border-line-strong px-6 font-medium"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </main>
  );
}
