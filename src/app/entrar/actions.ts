"use server";

import { redirect } from "next/navigation";
import {
  codeEmail,
  forgetCodeEmail,
  rememberCodeEmail,
} from "@/lib/code-email";
import { safePath } from "@/lib/safe-path";
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

  await rememberCodeEmail(email);
  redirect("/entrar?enviado=1");
}

// The 6-digit code in the same email as the magic link. It is for the app installed on the
// home screen: on iPhone it keeps its cookies apart from Safari, where the link opens, so the
// session has to start in the app itself. `next` is where to go after, `retry` where to show
// the error (both paths on this site).
export async function verifyCode(formData: FormData) {
  const next = safePath(String(formData.get("next") ?? ""));
  const retry = safePath(String(formData.get("retry") ?? ""));
  const join = retry.includes("?") ? "&" : "?";
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");

  const email = await codeEmail();
  if (!email) redirect(`${retry}${join}error=codigo_caducado`);
  if (code.length !== 6) redirect(`${retry}${join}error=codigo`);

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "email",
  });
  if (error) {
    redirect(
      `${retry}${join}error=${error.status === 429 ? "espera" : "codigo"}`,
    );
  }

  await forgetCodeEmail();
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
