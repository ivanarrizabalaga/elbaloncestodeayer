"use server";

import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

// «Pedir que se retire»: a priority item in the review queue (SPEC §5). Open to visitors,
// who arrive from a shared link; RLS only lets them file this one kind.
export async function requestRemoval(formData: FormData) {
  const slug = String(formData.get("slug") ?? "").replace(/[^a-z0-9-]/g, "");
  const field = (name: string, max: number) =>
    String(formData.get(name) ?? "")
      .trim()
      .slice(0, max);
  const reason = field("reason", 2000);
  if (!reason) redirect(`/foto/${slug}/retirar?error=motivo`);

  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("photos")
    .select("id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!photo) redirect("/");

  const user = await getCurrentUser();
  const payload: Record<string, string> = { reason };
  const name = field("name", 200);
  const contact = field("contact", 200);
  if (name) payload.name = name;
  if (contact) payload.contact = contact;

  // No .select(): visitors cannot read the queue back.
  const { error } = await supabase.from("review_items").insert({
    kind: "removal_request",
    photo_id: photo.id,
    created_by: user?.id ?? null,
    payload,
  });
  redirect(`/foto/${slug}/retirar?${error ? "error=enviar" : "enviado=1"}`);
}
