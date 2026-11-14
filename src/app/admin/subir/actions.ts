"use server";

import { revalidatePath } from "next/cache";
import { makeDerivatives, photoKeys } from "@/lib/derivatives";
import { getOriginal, presignOriginalUpload, putPublic } from "@/lib/storage";
import { createClient, requireAdmin } from "@/lib/supabase/server";

// Upload flow (SPEC §6):
// 1. startUpload: the server signs a URL for the original in the private bucket.
// 2. The browser PUTs the file there directly (no size limit from Vercel functions).
// 3. finishUpload: the server reads it back, writes the WebP derivatives to the public
//    bucket and creates the photo as a draft.

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/tiff"];
const MAX_BYTES = 50 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type StartUploadResult =
  { ok: true; id: string; uploadUrl: string } | { ok: false; error: string };

export async function startUpload(file: {
  type: string;
  size: number;
}): Promise<StartUploadResult> {
  await requireAdmin();
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: "Formato no admitido: usa JPG, PNG, WebP o TIFF.",
    };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "La foto pesa más de 50 MB." };
  }

  const id = crypto.randomUUID();
  const uploadUrl = await presignOriginalUpload(
    photoKeys(id).original,
    file.type,
  );
  return { ok: true, id, uploadUrl };
}

export type FinishUploadResult =
  { ok: true; id: string } | { ok: false; error: string };

export async function finishUpload(id: string): Promise<FinishUploadResult> {
  await requireAdmin();
  if (!UUID.test(id)) return { ok: false, error: "Subida no válida." };

  try {
    const keys = photoKeys(id);
    const original = await getOriginal(keys.original);
    const { large, thumb, width, height } = await makeDerivatives(original);
    await putPublic(keys.large, large, "image/webp");
    await putPublic(keys.thumb, thumb, "image/webp");

    // As the admin, through RLS (admins may insert photos).
    const supabase = await createClient();
    const { error } = await supabase.from("photos").insert({
      id,
      // Temporary: the real slug is set when the photo is published.
      slug: `borrador-${id.slice(0, 8)}`,
      status: "draft",
      storage_key: keys.storageKey,
      width,
      height,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("finishUpload failed", id, error);
    return {
      ok: false,
      error: "No se pudo procesar la foto. ¿Es una imagen válida?",
    };
  }

  revalidatePath("/admin/subir");
  return { ok: true, id };
}
