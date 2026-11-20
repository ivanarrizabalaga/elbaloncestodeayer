"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { similarForAdmin, type Similar } from "@/lib/lookalikes";
import { firstPublishFields } from "@/lib/publish";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import {
  deletePhotoFiles,
  processUpload,
  signUpload,
  UUID,
  type StartUploadResult,
} from "@/lib/uploads";

// Admin uploads become drafts (see src/lib/uploads.ts for the flow).

export async function startUpload(file: {
  type: string;
  size: number;
}): Promise<StartUploadResult> {
  await requireAdmin();
  return signUpload(file);
}

export type FinishUploadResult =
  { ok: true; id: string; similar: Similar[] } | { ok: false; error: string };

export async function finishUpload(id: string): Promise<FinishUploadResult> {
  await requireAdmin();
  if (!UUID.test(id)) return { ok: false, error: "Subida no válida." };

  // As the admin, through RLS (admins may insert photos).
  const supabase = await createClient();
  try {
    const { storageKey, width, height, imageHash } = await processUpload(id);
    const { error } = await supabase.from("photos").insert({
      id,
      // Temporary: the real slug is set when the photo is published.
      slug: `borrador-${id.slice(0, 8)}`,
      status: "draft",
      storage_key: storageKey,
      width,
      height,
      image_hash: imageHash,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("finishUpload failed", id, error);
    await deletePhotoFiles(id);
    return {
      ok: false,
      error: "No se pudo procesar la foto. ¿Es una imagen válida?",
    };
  }

  revalidatePath("/admin/subir");
  return { ok: true, id, similar: await similarForAdmin(supabase, id) };
}

// Bulk actions of the table view. The form sends the selected ids and the page to return to.

function selection(formData: FormData) {
  const ids = formData
    .getAll("id")
    .map(String)
    .filter((id) => UUID.test(id));
  const back = String(formData.get("back") ?? "");
  // Only back to this page, keeping its filters (never an outside URL).
  const url = new URL(
    back.startsWith("/admin/subir") ? back : "/admin/subir",
    "http://x",
  );
  url.searchParams.delete("ok");
  url.searchParams.delete("n");
  // Back to the first page: the handled drafts leave the list, so later pages shift.
  url.searchParams.delete("pagina");
  return { ids, url };
}

function done(url: URL, ok: string, n: number): never {
  url.searchParams.set("ok", ok);
  url.searchParams.set("n", String(n));
  revalidatePath("/admin/subir");
  redirect(`${url.pathname}${url.search}`);
}

// Publishes the selected drafts as they are, one by one (each gets its own slug).
export async function publishDrafts(formData: FormData) {
  const admin = await requireAdmin();
  const { ids, url } = selection(formData);
  const supabase = await createClient();
  const { data: drafts } = await supabase
    .from("photos")
    .select("id, team, team_2, season_label")
    .eq("status", "draft")
    .in("id", ids);

  let published = 0;
  for (const draft of drafts ?? []) {
    const fields = await firstPublishFields(supabase, draft, admin.id);
    const { error } = await supabase
      .from("photos")
      .update(fields)
      .eq("id", draft.id)
      .eq("status", "draft");
    if (error) console.error("publishDrafts failed", draft.id, error);
    else published++;
  }
  revalidatePath("/");
  done(url, "publicadas", published);
}

// Publishes every draft of an imported folder (source_file «<folder>/…»), not only the
// ones on the current page. Goes in batches: published drafts leave the query.
export async function publishFolder(formData: FormData) {
  const admin = await requireAdmin();
  const { url } = selection(formData);
  const folder = String(formData.get("carpeta") ?? "");
  if (!folder) done(url, "publicadas", 0);
  const supabase = await createClient();
  const pattern = `${folder.replace(/[\\%_]/g, "\\$&")}/%`;

  let published = 0;
  for (;;) {
    const { data: drafts } = await supabase
      .from("photos")
      .select("id, team, team_2, season_label")
      .eq("status", "draft")
      .like("source_file", pattern)
      .limit(100);
    if (!drafts?.length) break;
    let progress = 0;
    for (const draft of drafts) {
      const fields = await firstPublishFields(supabase, draft, admin.id);
      const { error } = await supabase
        .from("photos")
        .update(fields)
        .eq("id", draft.id)
        .eq("status", "draft");
      if (error) console.error("publishFolder failed", draft.id, error);
      else progress++;
    }
    published += progress;
    if (progress === 0) break; // every update failed: stop instead of looping forever
  }
  url.searchParams.delete("carpeta");
  revalidatePath("/");
  done(url, "publicadas", published);
}

// Discards the selected drafts: they become «rejected» and leave the list. Their files are
// kept, so a mistake can still be undone in the database.
export async function discardDrafts(formData: FormData) {
  await requireAdmin();
  const { ids, url } = selection(formData);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photos")
    .update({ status: "rejected" })
    .eq("status", "draft")
    .in("id", ids)
    .select("id");
  if (error) console.error("discardDrafts failed", error);
  done(url, "descartadas", data?.length ?? 0);
}
