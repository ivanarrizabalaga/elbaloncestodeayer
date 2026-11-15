"use server";

import { redirect } from "next/navigation";
import { addTag } from "@/app/admin/fotos/[id]/actions";
import { createPerson, nextLabelNumber } from "@/lib/people";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

// Contributions from the public photo page (SPEC §2). Users act through RLS:
// - tagging an existing person is published at once (and logged for the admins);
// - a name not in the archive leaves a «?» face plus a name suggestion for review;
// - admins act directly (they may create people).

export type ActionResult =
  { ok: true; message?: string } | { ok: false; error: string };

type Picked = { id: string } | { newName: string } | null;

export async function tagFace(input: {
  photoId: string;
  x: number;
  y: number;
  person: Picked;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entra para poder etiquetar." };
  if (user.isAdmin) return addTag(input);

  if (
    ![input.x, input.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)
  ) {
    return { ok: false, error: "Posición no válida." };
  }

  const supabase = await createClient();
  const personId =
    input.person && "id" in input.person ? input.person.id : null;

  // Two people tagging at once could take the same number: retry once.
  let tagId: string | null = null;
  for (let attempt = 0; attempt < 2 && !tagId; attempt++) {
    const { data, error } = await supabase
      .from("tags")
      .insert({
        photo_id: input.photoId,
        person_id: personId,
        x: input.x,
        y: input.y,
        label_number: await nextLabelNumber(supabase, input.photoId),
        created_by: user.id,
      })
      .select("id")
      .single();
    if (data) tagId = data.id;
    else if (error?.code !== "23505") break;
  }
  if (!tagId) return { ok: false, error: "No se pudo guardar la etiqueta." };

  if (input.person && "newName" in input.person) {
    await supabase.from("review_items").insert({
      kind: "name_suggestion",
      tag_id: tagId,
      photo_id: input.photoId,
      created_by: user.id,
      payload: { name: input.person.newName.trim().slice(0, 200) },
    });
    return {
      ok: true,
      message:
        "Etiqueta añadida. Revisaremos el nombre y lo añadiremos al archivo.",
    };
  }
  return { ok: true };
}

// «Sé quién es» on a «?» face (or a correction). Users: to review. Admins: applied at once.
export async function suggestName(input: {
  tagId: string;
  photoId: string;
  person: { id: string } | { newName: string };
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entra para poder ayudar." };
  const supabase = await createClient();

  if (user.isAdmin) {
    const personId =
      "id" in input.person
        ? input.person.id
        : await createPerson(supabase, input.person.newName, user.id);
    if (!personId) return { ok: false, error: "No se pudo crear la persona." };
    const { error } = await supabase
      .from("tags")
      .update({ person_id: personId })
      .eq("id", input.tagId);
    return error ? { ok: false, error: "No se pudo guardar." } : { ok: true };
  }

  const { error } = await supabase.from("review_items").insert({
    kind: "name_suggestion",
    tag_id: input.tagId,
    photo_id: input.photoId,
    person_id: "id" in input.person ? input.person.id : null,
    created_by: user.id,
    payload:
      "newName" in input.person
        ? { name: input.person.newName.trim().slice(0, 200) }
        : {},
  });
  return error
    ? { ok: false, error: "No se pudo enviar la sugerencia." }
    : { ok: true, message: "¡Gracias! Lo revisaremos pronto." };
}

export async function removeOwnTag(tagId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_own_tag", { p_tag_id: tagId });
  return error
    ? { ok: false, error: "No se pudo quitar la etiqueta." }
    : { ok: true, message: "Etiqueta quitada." };
}

// Memories: plain forms that come back to the photo page.

export async function addMemory(formData: FormData) {
  const { slug, body } = memoryFields(formData);
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("photos")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (photo && body) {
    await supabase
      .from("memories")
      .insert({ photo_id: photo.id, author_id: user.id, body });
  }
  redirect(`/foto/${slug}#historia`);
}

export async function updateMemory(formData: FormData) {
  const { slug, body, id } = memoryFields(formData);
  const supabase = await createClient();
  if (body) await supabase.from("memories").update({ body }).eq("id", id);
  redirect(`/foto/${slug}#historia`);
}

export async function deleteMemory(formData: FormData) {
  const { slug, id } = memoryFields(formData);
  const supabase = await createClient();
  await supabase.from("memories").delete().eq("id", id);
  redirect(`/foto/${slug}#historia`);
}

function memoryFields(formData: FormData) {
  return {
    id: String(formData.get("id") ?? ""),
    slug: String(formData.get("slug") ?? "").replace(/[^a-z0-9-]/g, ""),
    body: String(formData.get("body") ?? "")
      .trim()
      .slice(0, 4000),
  };
}
