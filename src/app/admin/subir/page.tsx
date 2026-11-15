import type { Metadata } from "next";
import { PhotoGrid } from "@/components/photo-grid";
import { createClient } from "@/lib/supabase/server";
import { PhotoUploader } from "@/components/photo-uploader";
import { finishUpload, startUpload } from "./actions";

export const metadata: Metadata = { title: "Subir fotos" };

export default async function UploadPage() {
  // The admin layout already checked the role; RLS lets admins read drafts.
  const supabase = await createClient();
  const { data: drafts } = await supabase
    .from("photos")
    .select("id, slug, team, season_label, storage_key, width, height")
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-8 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[40px] leading-none font-bold">
          Subir fotos
        </h1>
        <p className="text-muted">
          Sube varias de golpe. Se quedan en borrador hasta que las publiques.
        </p>
      </div>

      <PhotoUploader
        start={startUpload}
        finish={finishUpload}
        doneLabel="Lista, en borradores"
      />

      <section aria-labelledby="borradores" className="flex flex-col gap-4">
        <h2
          id="borradores"
          className="font-display text-[30px] leading-none font-bold"
        >
          Borradores{drafts?.length ? ` (${drafts.length})` : ""}
        </h2>
        {drafts?.length ? (
          <PhotoGrid
            photos={drafts.map((d) => ({
              ...d,
              href: `/admin/fotos/${d.id}`,
              caption:
                [d.season_label, d.team].filter(Boolean).join(" · ") ||
                "Sin datos",
            }))}
          />
        ) : (
          <p className="text-muted">No hay borradores.</p>
        )}
      </section>
    </main>
  );
}
