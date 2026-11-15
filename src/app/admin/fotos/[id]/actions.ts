"use server";

import { redirect } from "next/navigation";
import { parseSeason } from "@/lib/photos";
import { createPerson, nextLabelNumber } from "@/lib/people";
import { firstPublishFields } from "@/lib/publish";
import { withdrawnByContributor } from "@/lib/review";
import { createClient, requireAdmin } from "@/lib/supabase/server";

// Every action runs as the signed-in admin, so RLS checks it again.

export type TagResult = { ok: true } | { ok: false; error: string };

// Tag a face. person: an existing person, a new name to create, or null for «?».
export async function addTag(input: {
  photoId: string;
  x: number;
  y: number;
  person: { id: string } | { newName: string } | null;
}): Promise<TagResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  if (!inUnitRange(input.x) || !inUnitRange(input.y)) {
    return { ok: false, error: "Posición no válida." };
  }

  let personId: string | null = null;
  if (input.person && "id" in input.person) {
    personId = input.person.id;
  } else if (input.person) {
    personId = await createPerson(supabase, input.person.newName, admin.id);
    if (!personId) return { ok: false, error: "No se pudo crear la persona." };
  }

  const { error } = await supabase.from("tags").insert({
    photo_id: input.photoId,
    person_id: personId,
    x: input.x,
    y: input.y,
    label_number: await nextLabelNumber(supabase, input.photoId),
    created_by: admin.id,
  });
  if (error) return { ok: false, error: "No se pudo guardar la etiqueta." };
  return { ok: true };
}

// Soft delete: the tag stays in the history (removed_at / removed_by).
export async function removeTag(tagId: string): Promise<TagResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tags")
    .update({ removed_at: new Date().toISOString(), removed_by: admin.id })
    .eq("id", tagId);
  if (error) return { ok: false, error: "No se pudo quitar la etiqueta." };
  return { ok: true };
}

// The details form. intent=publish also publishes a draft and gives it its final slug.
export async function savePhoto(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const intent = String(formData.get("intent") ?? "save");
  const text = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return value === "" ? null : value;
  };

  const seasonLabel = text("season_label");
  const { yearFrom, yearTo } = parseSeason(seasonLabel ?? "");
  const instagramUrl = text("instagram_url");
  if (
    instagramUrl &&
    !/^https:\/\/(www\.)?instagram\.com\//.test(instagramUrl)
  ) {
    redirect(`/admin/fotos/${id}?error=instagram`);
  }

  const { data: photo } = await supabase
    .from("photos")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!photo) redirect("/admin/subir");

  const team = text("team");
  const changes = {
    season_label: seasonLabel,
    year_from: yearFrom,
    year_to: yearTo,
    team,
    venue: text("venue"),
    competition: text("competition"),
    provenance: text("provenance"),
    photographer: text("photographer"),
    story: text("story"),
    instagram_url: instagramUrl,
    featured: formData.get("featured") === "on",
  };

  // A photo its contributor took down stays down (SPEC §5); one an admin withdrew can
  // come back, with the address it already had.
  const republishing = intent === "publish" && photo.status === "withdrawn";
  if (republishing && (await withdrawnByContributor(supabase, id))) {
    redirect(`/admin/fotos/${id}?error=retirada`);
  }
  const publishing =
    intent === "publish" &&
    (photo.status === "draft" || photo.status === "proposed");
  let publishFields = {};
  if (republishing) {
    publishFields = { status: "published" as const };
  } else if (publishing) {
    publishFields = await firstPublishFields(
      supabase,
      { team, season_label: seasonLabel },
      admin.id,
    );
  }

  const { error } = await supabase
    .from("photos")
    .update({ ...changes, ...publishFields })
    .eq("id", id);
  if (error) redirect(`/admin/fotos/${id}?error=guardar`);

  // A published proposal leaves the review queue.
  if (publishing && photo.status === "proposed") {
    await supabase
      .from("review_items")
      .update({
        status: "resolved",
        resolved_by: admin.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("photo_id", id)
      .eq("kind", "photo_proposal")
      .eq("status", "open");
  }

  redirect(
    `/admin/fotos/${id}?ok=${publishing || republishing ? "publicada" : "guardada"}`,
  );
}

// «Retirar foto»: it stops being visible; tags, memories and the original are kept, so it
// can be published again. Open withdrawal requests for it are done.
export async function withdrawPhoto(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");

  const { data: photo } = await supabase
    .from("photos")
    .update({ status: "withdrawn", featured: false })
    .eq("id", id)
    .eq("status", "published")
    .select("id")
    .maybeSingle();
  if (!photo) redirect(`/admin/fotos/${id}?error=guardar`);

  await supabase
    .from("review_items")
    .update({
      status: "resolved",
      resolved_by: admin.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("photo_id", id)
    .eq("kind", "removal_request")
    .eq("status", "open");

  redirect(`/admin/fotos/${id}?ok=retirada`);
}

function inUnitRange(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 1;
}
