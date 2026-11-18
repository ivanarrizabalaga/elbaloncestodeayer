"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { UploadMeta } from "@/components/photo-uploader";
import { similarForUser, type Similar } from "@/lib/lookalikes";
import { readPhotoDetails } from "@/lib/photo-details";
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

type ProposalResult =
  { ok: true; similar: Similar[] } | { ok: false; error: string };

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
  { comment, fileName, details }: UploadMeta,
): Promise<ProposalResult> {
  const allowed = await canPropose();
  if (!allowed.ok) return allowed;
  if (!UUID.test(id)) return { ok: false, error: "Subida no válida." };
  // Shown in «Tus fotos» while the photo has no team. No «/», so it never counts as an
  // imported folder (draft_folders).
  const sourceFile =
    String(fileName ?? "")
      .replace(/[/\\]/g, "_")
      .trim()
      .slice(0, 200) || null;

  const supabase = await createClient();
  try {
    const { storageKey, width, height, imageHash } = await processUpload(id);
    const { error } = await supabase.from("photos").insert({
      // The «datos comunes» of the batch, if any; editable later from «Tus fotos».
      ...readPhotoDetails((name) => details?.[name]),
      id,
      // Temporary: the real slug is set when an admin publishes it.
      slug: `propuesta-${id.slice(0, 8)}`,
      status: "proposed",
      proposed_by: allowed.userId,
      storage_key: storageKey,
      width,
      height,
      image_hash: imageHash,
      source_file: sourceFile,
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
    payload: comment ? { comment: String(comment).slice(0, 2000) } : {},
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
  return { ok: true, similar: await similarForUser(supabase, id) };
}

// «Retirar mi foto»: not published yet → deleted with its files; published → withdrawn
// (the original stays until confirmed, SPEC §5).
export async function withdrawOwnPhoto(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) redirect("/proponer?aviso=error");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("withdraw_own_photo", {
    p_photo_id: id,
  });
  if (error) redirect("/proponer?aviso=error");
  if (data === "deleted") await deletePhotoFiles(id);

  revalidatePath("/proponer");
  redirect(`/proponer?aviso=${data === "deleted" ? "borrada" : "retirada"}`);
}

// /proponer/[id]: the proposer fills in or corrects the details while it is pending. The
// function checks it is theirs and still 'proposed'.
export async function saveOwnProposal(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) redirect("/proponer");
  const d = readPhotoDetails((name) => formData.get(name));

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_own_proposal", {
    p_photo_id: id,
    p_season_label: d.season_label ?? "",
    p_year_from: d.year_from ?? undefined,
    p_year_to: d.year_to ?? undefined,
    p_team: d.team ?? "",
    p_venue: d.venue ?? "",
    p_competition: d.competition ?? "",
    p_provenance: d.provenance ?? "",
    p_photographer: d.photographer ?? "",
    p_story: d.story ?? "",
  });
  if (error) redirect(`/proponer/${id}?error=1`);

  revalidatePath("/proponer");
  redirect("/proponer?aviso=datos");
}
