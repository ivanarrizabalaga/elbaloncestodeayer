"use server";

import { redirect, RedirectType } from "next/navigation";
import { createClient, requireAdmin } from "@/lib/supabase/server";

// /admin/personas/[id]. Both run as the signed-in admin: editing goes through the
// «people: admin update» policy, merging through merge_people(), which checks it again.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function id(formData: FormData, field: string): string {
  const value = String(formData.get(field) ?? "");
  if (!UUID.test(value)) redirect("/admin/personas");
  return value;
}

// Name and bio. The slug stays, so links already shared keep working.
export async function savePerson(formData: FormData) {
  await requireAdmin();
  const personId = id(formData, "id");
  const back = `/admin/personas/${personId}`;
  const fullName = String(formData.get("full_name") ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const bio = String(formData.get("bio") ?? "").trim();
  if (!fullName || fullName.length > 200 || bio.length > 2000) {
    redirect(`${back}?error=datos`, RedirectType.replace);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("people")
    .update({ full_name: fullName, bio: bio || null })
    .eq("id", personId);
  redirect(
    `${back}?${error ? "error=guardar" : "ok=guardada"}`,
    RedirectType.replace,
  );
}

// This person is a duplicate of `target`: everything moves there and its page redirects.
export async function mergePerson(formData: FormData) {
  await requireAdmin();
  const source = id(formData, "id");
  const target = id(formData, "target");

  const supabase = await createClient();
  const { error } = await supabase.rpc("merge_people", {
    p_source: source,
    p_target: target,
  });
  if (error) {
    const code = error.message === "both_claimed" ? "cuentas" : "fusionar";
    redirect(`/admin/personas/${source}?error=${code}`, RedirectType.replace);
  }
  redirect(`/admin/personas/${target}?ok=fusionada`, RedirectType.replace);
}
