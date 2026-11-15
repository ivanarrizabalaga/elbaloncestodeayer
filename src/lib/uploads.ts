import "server-only";
import { imageHash, makeDerivatives, photoKeys } from "@/lib/derivatives";
import {
  deleteOriginal,
  deletePublic,
  getOriginal,
  presignOriginalUpload,
  putPublic,
} from "@/lib/storage";

// Upload flow shared by admins (drafts) and users (proposals), SPEC §6:
// 1. signUpload: the server signs a URL for the original in the private bucket.
// 2. The browser PUTs the file there directly (no size limit from Vercel functions).
// 3. processUpload: the server reads it back, writes the WebP derivatives to the public
//    bucket and computes its image_hash; the caller then creates the photo row and can warn
//    about photos that look the same (similarForAdmin / similarForUser in lookalikes.ts).

export const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
];
const MAX_BYTES = 50 * 1024 * 1024;
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type StartUploadResult =
  { ok: true; id: string; uploadUrl: string } | { ok: false; error: string };

export async function signUpload(file: {
  type: string;
  size: number;
}): Promise<StartUploadResult> {
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

export async function processUpload(id: string) {
  const keys = photoKeys(id);
  const original = await getOriginal(keys.original);
  const { large, thumb, width, height } = await makeDerivatives(original);
  const hash = await imageHash(original);
  await putPublic(keys.large, large, "image/webp");
  await putPublic(keys.thumb, thumb, "image/webp");
  return { storageKey: keys.storageKey, width, height, imageHash: hash };
}

// Removes every file of a photo (rejected or withdrawn-before-publishing proposals,
// failed uploads). Best effort: a leftover file is harmless, a thrown error is not.
export async function deletePhotoFiles(id: string): Promise<void> {
  const keys = photoKeys(id);
  const results = await Promise.allSettled([
    deleteOriginal(keys.original),
    deletePublic(keys.large),
    deletePublic(keys.thumb),
  ]);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("deletePhotoFiles", id, result.reason);
    }
  }
}
