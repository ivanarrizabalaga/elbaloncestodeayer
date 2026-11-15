"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  deletePhotoFiles,
  processUpload,
  signUpload,
  UUID,
  type StartUploadResult,
} from "@/lib/uploads";

// Users propose photos (SPEC §2): same upload flow as admins, but the photo is created as
// 'proposed' (RLS) with a photo_proposal item in the review queue.

// Enough for anyone emptying a shoebox; stops a runaway script.
const DAILY_LIMIT = 30;

type Result = { ok: true } | { ok: false; error: string };

async function canPropose(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entra para proponer fotos." };
  if (user.isBlocked) {
    return { ok: false, error: "Tu cuenta no puede proponer fotos." };
  }
  const supabase = await createClient();
  const { count } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("proposed_by", user.id)
    .gt("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
  if ((count ?? 0) >= DAILY_LIMIT) {
    return {
      ok: false,
      error: `Has llegado al máximo de ${DAILY_LIMIT} fotos al día. Sigue mañana.`,
    };
  }
  return { ok: true, userId: user.id };
}

export async function startProposal(file: {
  type: string;
  size: number;
}): Promise<StartUploadResult> {
  const allowed = await canPropose();
  if (!allowed.ok) return allowed;
  return signUpload(file);
}

export async function finishProposal(
  id: string,
  comment: string,
): Promise<Result> {
  const allowed = await canPropose();
  if (!allowed.ok) return allowed;
  if (!UUID.test(id)) return { ok: false, error: "Subida no válida." };

  const supabase = await createClient();
  try {
    const { storageKey, width, height } = await processUpload(id);
    const { error } = await supabase.from("photos").insert({
      id,
      // Temporary: the real slug is set when an admin publishes it.
      slug: `propuesta-${id.slice(0, 8)}`,
      status: "proposed",
      proposed_by: allowed.userId,
      storage_key: storageKey,
      width,
      height,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("finishProposal failed", id, error);
    await deletePhotoFiles(id);
    return {
      ok: false,
      error: "No se pudo procesar la foto. ¿Es una imagen válida?",
    };
  }

  const { error } = await supabase.from("review_items").insert({
    kind: "photo_proposal",
    photo_id: id,
    created_by: allowed.userId,
    payload: comment ? { comment: comment.slice(0, 2000) } : {},
  });
  if (error) {
    // Without a queue item nobody would review it: undo the whole thing.
    await supabase.rpc("withdraw_own_photo", { p_photo_id: id });
    await deletePhotoFiles(id);
    return {
      ok: false,
      error: "No se pudo enviar la foto. Inténtalo otra vez.",
    };
  }

  revalidatePath("/proponer");
  return { ok: true };
}

// «Retirar mi foto»: not published yet → deleted with its files; published → withdrawn
// (the original stays until confirmed, SPEC §5).
export async function withdrawOwnPhoto(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) redirect("/proponer?retirada=error");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("withdraw_own_photo", {
    p_photo_id: id,
  });
  if (error) redirect("/proponer?retirada=error");
  if (data === "deleted") await deletePhotoFiles(id);

  revalidatePath("/proponer");
  redirect(`/proponer?retirada=${data === "deleted" ? "borrada" : "retirada"}`);
}
