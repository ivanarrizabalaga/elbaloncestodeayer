"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
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
  const uploadUrl = await presignOriginalUpload(originalKey(id), file.type);
  return { ok: true, id, uploadUrl };
}

export type FinishUploadResult =
  { ok: true; id: string } | { ok: false; error: string };

export async function finishUpload(id: string): Promise<FinishUploadResult> {
  await requireAdmin();
  if (!UUID.test(id)) return { ok: false, error: "Subida no válida." };

  try {
    const original = await getOriginal(originalKey(id));

    // rotate() applies the EXIF orientation; limitInputPixels guards against huge files.
    const image = sharp(original, { limitInputPixels: 200_000_000 }).rotate();
    const large = await image
      .clone()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await image
      .clone()
      .resize({ width: 480, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();

    const storageKey = `photos/${id}`;
    await putPublic(`${storageKey}/large.webp`, large.data, "image/webp");
    await putPublic(`${storageKey}/thumb.webp`, thumb, "image/webp");

    // As the admin, through RLS (admins may insert photos).
    const supabase = await createClient();
    const { error } = await supabase.from("photos").insert({
      id,
      // Temporary: the real slug is set when the photo is published.
      slug: `borrador-${id.slice(0, 8)}`,
      status: "draft",
      storage_key: storageKey,
      width: large.info.width,
      height: large.info.height,
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

function originalKey(id: string): string {
  return `photos/${id}/original`;
}
