"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPerson } from "@/lib/people";
import { payloadText } from "@/lib/review";
import { fold } from "@/lib/slug";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { deletePhotoFiles } from "@/lib/uploads";

// The review queue and Recent activity. Every action runs as the signed-in admin, so RLS
// checks it again. The form only says which items; what to do is read from the database.

const PATH = "/admin/pendiente";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function ids(formData: FormData): string[] {
  return String(formData.get("ids") ?? "")
    .split(",")
    .filter((id) => UUID.test(id));
}

function fail(): never {
  redirect(`${PATH}?error=1`);
}

async function openItems(itemIds: string[]) {
  if (itemIds.length === 0) fail();
  const supabase = await createClient();
  const { data } = await supabase
    .from("review_items")
    .select("id, kind, tag_id, person_id, photo_id, payload, created_by")
    .in("id", itemIds)
    .eq("status", "open");
  if (!data?.length) fail();
  return { supabase, items: data };
}

async function close(
  itemIds: string[],
  status: "resolved" | "dismissed",
  adminId: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("review_items")
    .update({
      status,
      resolved_by: adminId,
      resolved_at: new Date().toISOString(),
    })
    .in("id", itemIds)
    .eq("status", "open");
  if (error) fail();
}

// «Me lo quedo»
export async function takeItems(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  await supabase
    .from("review_items")
    .update({ assigned_to: admin.id })
    .in("id", ids(formData))
    .eq("status", "open");
  revalidatePath(PATH);
}

// «Descartar», «Mantener», «Hecho»: close without changing anything else.
export async function dismissItems(formData: FormData) {
  const admin = await requireAdmin();
  await close(ids(formData), "dismissed", admin.id);
  revalidatePath(PATH);
}

export async function resolveItems(formData: FormData) {
  const admin = await requireAdmin();
  await close(ids(formData), "resolved", admin.id);
  revalidatePath(PATH);
}

// Name suggestion accepted: the face gets that person (created if needed). Other open
// suggestions for the same face no longer apply.
export async function acceptSuggestion(formData: FormData) {
  const admin = await requireAdmin();
  const { supabase, items } = await openItems(ids(formData));
  const item = items[0];
  if (item.kind !== "name_suggestion" || !item.tag_id) fail();

  let personId = item.person_id;
  if (!personId) {
    const name = payloadText(item.payload, "name");
    if (!name) fail();
    personId =
      (await findPersonByName(supabase, name)) ??
      (await createPerson(supabase, name, admin.id));
    if (!personId) fail();
  }

  const { data: tag } = await supabase
    .from("tags")
    .update({ person_id: personId })
    .eq("id", item.tag_id)
    .is("removed_at", null)
    .select("id")
    .maybeSingle();
  if (!tag) fail();

  await close(
    items.map((i) => i.id),
    "resolved",
    admin.id,
  );
  await supabase
    .from("review_items")
    .update({
      status: "dismissed",
      resolved_by: admin.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("kind", "name_suggestion")
    .eq("tag_id", item.tag_id)
    .eq("status", "open");
  revalidatePath(PATH);
}

// «No soy yo» accepted: the face goes back to «?», the invitation stops working and, if
// they proposed a name, it becomes a name suggestion in the queue.
export async function clearDisputedTag(formData: FormData) {
  const admin = await requireAdmin();
  const { supabase, items } = await openItems(ids(formData));
  const item = items[0];
  if (item.kind !== "tag_dispute") fail();

  if (item.tag_id) {
    const { error } = await supabase
      .from("tags")
      .update({ person_id: null })
      .eq("id", item.tag_id);
    if (error) fail();
  }

  const invitationId = payloadText(item.payload, "invitation_id");
  if (invitationId) {
    await supabase
      .from("invitations")
      .update({ expires_at: new Date().toISOString() })
      .eq("id", invitationId)
      .is("accepted_at", null);
  }

  const suggested = payloadText(item.payload, "suggested_name");
  if (suggested && item.tag_id) {
    const { data: tag } = await supabase
      .from("tags")
      .select("photo_id")
      .eq("id", item.tag_id)
      .maybeSingle();
    await supabase.from("review_items").insert({
      kind: "name_suggestion",
      tag_id: item.tag_id,
      photo_id: tag?.photo_id ?? null,
      person_id: await findPersonByName(supabase, suggested),
      payload: { name: suggested },
      // Whoever said «No soy yo» (null for visitors), not the admin passing it on.
      created_by: item.created_by,
    });
  }

  await close([item.id], "resolved", admin.id);
  revalidatePath(PATH);
}

// Withdrawal request: the photo stops being visible. The original stays in storage until
// someone confirms it can go (SPEC §5).
export async function withdrawPhoto(formData: FormData) {
  const admin = await requireAdmin();
  const { supabase, items } = await openItems(ids(formData));
  const item = items[0];
  if (item.kind !== "removal_request" || !item.photo_id) fail();

  const { error } = await supabase
    .from("photos")
    .update({ status: "withdrawn" })
    .eq("id", item.photo_id);
  if (error) fail();

  await close([item.id], "resolved", admin.id);
  revalidatePath(PATH);
}

// Recent activity: undo what was published without review.
export async function undoActivity(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) fail();

  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("activity")
    .select("action, actor_id, target_id")
    .eq("id", id)
    .maybeSingle();
  if (!entry?.target_id) fail();

  const now = new Date().toISOString();
  let error: unknown = null;
  switch (entry.action) {
    case "tag_added":
      ({ error } = await supabase
        .from("tags")
        .update({ removed_at: now, removed_by: admin.id })
        .eq("id", entry.target_id)
        .is("removed_at", null));
      break;
    case "memory_added":
      ({ error } = await supabase
        .from("memories")
        .update({ hidden_at: now })
        .eq("id", entry.target_id));
      break;
    case "person_claimed":
    case "invitation_accepted":
      // Only if it is still that account's person.
      if (!entry.actor_id) fail();
      ({ error } = await supabase
        .from("people")
        .update({ claimed_by: null })
        .eq("id", entry.target_id)
        .eq("claimed_by", entry.actor_id));
      break;
    default:
      fail();
  }
  if (error) fail();
  revalidatePath(PATH);
}

// Accent- and case-insensitive match on an existing (not merged) person.
async function findPersonByName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("people")
    .select("id, full_name")
    .is("merged_into", null);
  const wanted = fold(name);
  return data?.find((p) => fold(p.full_name) === wanted)?.id ?? null;
}

// Proposed photo not accepted: the files are deleted and the row stays as 'rejected' (without
// files) so the user sees what happened in «Tus fotos».
export async function rejectProposal(formData: FormData) {
  const admin = await requireAdmin();
  const { supabase, items } = await openItems(ids(formData));
  const item = items[0];
  if (item.kind !== "photo_proposal" || !item.photo_id) fail();

  const { data: photo } = await supabase
    .from("photos")
    .update({
      status: "rejected",
      storage_key: null,
      width: null,
      height: null,
    })
    .eq("id", item.photo_id)
    .eq("status", "proposed")
    .select("id")
    .maybeSingle();
  if (!photo) fail();
  await deletePhotoFiles(photo.id);

  await close([item.id], "dismissed", admin.id);
  revalidatePath(PATH);
}
