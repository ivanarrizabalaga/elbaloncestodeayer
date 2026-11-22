"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { deletePhotoFiles } from "@/lib/uploads";

// «Mi cuenta». Name and mention emails go through RLS (users may only update those columns
// of their own profile).

export async function updateName(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const name = String(formData.get("name") ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
  if (!name) redirect("/cuenta?error=nombre");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", user.id);
  revalidatePath("/", "layout");
  redirect(`/cuenta?${error ? "error=guardar" : "ok=nombre"}`);
}

// Emails when someone mentions you in a memory (src/lib/mention-digest.ts).
export async function setMentionEmails(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ mention_emails: formData.get("on") === "1" })
    .eq("id", user.id);
  redirect(`/cuenta?${error ? "error=guardar" : "ok=avisos"}`);
}

// «Borrar mi cuenta» (see delete_own_account for what stays and what goes).
export async function deleteAccount() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  const supabase = await createClient();
  const { data: deletedPhotos, error } =
    await supabase.rpc("delete_own_account");
  if (error) {
    redirect(
      `/cuenta?error=${error.message.includes("at least one admin") ? "ultimo" : "borrar"}`,
    );
  }
  await Promise.all((deletedPhotos ?? []).map((id) => deletePhotoFiles(id)));

  // The account no longer exists: only the local session cookies are left to clear.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/?cuenta=borrada");
}
