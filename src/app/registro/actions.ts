"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// «Pide acceso»: files a request for an admin to review. The answer is the same whether the
// email already has an account or a pending request (request_access ignores those).
export async function requestAccess(formData: FormData) {
  // Honeypot: people never see this field, bots tend to fill it.
  if (String(formData.get("web") ?? "") !== "") redirect("/registro?enviado=1");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (formData.get("age") !== "on") redirect("/registro?error=edad");
  if (name.length < 1 || name.length > 120) redirect("/registro?error=nombre");
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    redirect("/registro?error=email");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_access", {
    p_name: name,
    p_email: email,
    p_age_confirmed: true,
  });
  if (error) {
    console.error("requestAccess failed", error);
    redirect("/registro?error=envio");
  }
  redirect("/registro?enviado=1");
}
