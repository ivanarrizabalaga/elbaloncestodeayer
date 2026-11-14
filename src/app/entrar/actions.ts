"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sends a magic link to an existing account. New accounts are created through invitations
// (phase 5), so here shouldCreateUser is false. To avoid revealing which emails have an
// account, the answer is the same whether the email exists or not.
export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    redirect("/entrar?error=email");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (error?.status === 429) {
    redirect("/entrar?error=espera");
  }

  redirect("/entrar?enviado=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
