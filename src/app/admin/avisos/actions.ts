"use server";

import { redirect } from "next/navigation";
import { createClient, requireAdmin } from "@/lib/supabase/server";

// Pause or resume the mention emails. RLS allows it to admins only, too.
export async function setMentionEmailsPaused(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  await supabase
    .from("mention_settings")
    .update({
      paused: formData.get("paused") === "1",
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    })
    .eq("id", true);
  redirect("/admin/avisos");
}
