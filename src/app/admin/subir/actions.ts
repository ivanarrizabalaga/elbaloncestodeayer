"use server";

import { revalidatePath } from "next/cache";
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
  { ok: true; id: string } | { ok: false; error: string };

export async function finishUpload(id: string): Promise<FinishUploadResult> {
  await requireAdmin();
  if (!UUID.test(id)) return { ok: false, error: "Subida no válida." };

  try {
    const { storageKey, width, height } = await processUpload(id);
    // As the admin, through RLS (admins may insert photos).
    const supabase = await createClient();
    const { error } = await supabase.from("photos").insert({
      id,
      // Temporary: the real slug is set when the photo is published.
      slug: `borrador-${id.slice(0, 8)}`,
      status: "draft",
      storage_key: storageKey,
      width,
      height,
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
  return { ok: true, id };
}
