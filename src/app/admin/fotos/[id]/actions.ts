"use server";

import { redirect } from "next/navigation";
import { parseSeason } from "@/lib/photos";
import { slugify, uniqueSlug } from "@/lib/slug";
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
    const fullName = input.person.newName.trim().replace(/\s+/g, " ");
    if (!fullName) return { ok: false, error: "Escribe un nombre." };
    const base = slugify(fullName);
    const { data: similar } = await supabase
      .from("people")
      .select("slug")
      .like("slug", `${base}%`);
    const { data: created, error } = await supabase
      .from("people")
      .insert({
        full_name: fullName,
        slug: uniqueSlug(
          base,
          (similar ?? []).map((p) => p.slug),
        ),
        created_by: admin.id,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: "No se pudo crear la persona." };
    personId = created.id;
  }

  // Next number among the active tags of this photo.
  const { data: last } = await supabase
    .from("tags")
    .select("label_number")
    .eq("photo_id", input.photoId)
    .is("removed_at", null)
    .order("label_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("tags").insert({
    photo_id: input.photoId,
    person_id: personId,
    x: input.x,
    y: input.y,
    label_number: (last?.label_number ?? 0) + 1,
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

  const publishing = intent === "publish" && photo.status !== "published";
  let publishFields = {};
  if (publishing) {
    const base = slugify(
      [team, seasonLabel].filter(Boolean).join(" ") || "foto",
    );
    const { data: similar } = await supabase
      .from("photos")
      .select("slug")
      .like("slug", `${base}%`);
    publishFields = {
      status: "published" as const,
      slug: uniqueSlug(
        base,
        (similar ?? []).map((p) => p.slug),
      ),
      published_at: new Date().toISOString(),
      published_by: admin.id,
    };
  }

  const { error } = await supabase
    .from("photos")
    .update({ ...changes, ...publishFields })
    .eq("id", id);
  if (error) redirect(`/admin/fotos/${id}?error=guardar`);

  redirect(`/admin/fotos/${id}?ok=${publishing ? "publicada" : "guardada"}`);
}

function inUnitRange(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 1;
}
