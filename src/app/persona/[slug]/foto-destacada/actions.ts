"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SLUG = /^[a-z0-9-]+$/;

// The permission checks (the person themselves or an admin; one of their tags on a published
// photo) live in set_person_portrait. An empty tag goes back to the automatic choice.
export async function setPortrait(formData: FormData) {
  const personId = String(formData.get("personId") ?? "");
  const tagId = String(formData.get("tagId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (
    !UUID.test(personId) ||
    (tagId && !UUID.test(tagId)) ||
    !SLUG.test(slug)
  ) {
    redirect("/");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_person_portrait", {
    p_person_id: personId,
    p_tag_id: tagId || undefined,
  });
  if (error) redirect(`/persona/${slug}/foto-destacada?error=1`);
  revalidatePath(`/persona/${slug}`);
  redirect(`/persona/${slug}`);
}
