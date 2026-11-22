"use server";

import { redirect } from "next/navigation";
import { rememberCodeEmail } from "@/lib/code-email";
import {
  errorCode,
  hashInvitationToken,
  newInvitationToken,
} from "@/lib/invitations";
import { siteOrigin } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

// «Invitar»: any signed-in, unblocked user can invite a tagged person (RLS checks it).
export async function createInvitation(input: {
  personId: string;
  tagId: string | null;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entra para poder invitar." };

  const supabase = await createClient();
  const { token, hash } = newInvitationToken();
  const { error } = await supabase.from("invitations").insert({
    token_hash: hash,
    role: "user",
    person_id: input.personId,
    tag_id: input.tagId,
    invited_by: user.id,
  });
  if (error) return { ok: false, error: "No se pudo crear la invitación." };

  return { ok: true, url: `${await siteOrigin()}/invitacion/${token}` };
}

// «Sí, soy yo» from a visitor: create the account if needed and email a magic link that
// comes back to the invitation.
export async function requestInvitationLink(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const back = `/invitacion/${encodeURIComponent(token)}`;

  if (formData.get("consent") !== "on") {
    redirect(`${back}?paso=email&error=consentimiento`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    redirect(`${back}?paso=email&error=email`);
  }

  const supabase = await createClient();
  const { data: preview } = await supabase
    .rpc("invitation_preview", { p_token: token })
    .maybeSingle();
  if (!preview || preview.status !== "valid") redirect(back);

  // Bind the invitation to the first email used, so one link cannot create many accounts.
  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from("invitations")
    .select("id, email")
    .eq("token_hash", hashInvitationToken(token))
    .single();
  if (!invitation) redirect(back);
  if (invitation.email && invitation.email !== email) {
    redirect(`${back}?paso=email&error=email_otra`);
  }
  if (!invitation.email) {
    await admin.from("invitations").update({ email }).eq("id", invitation.id);
  }

  // Create the account (no-op if it already exists).
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createError && createError.code !== "email_exists") {
    console.error("requestInvitationLink: createUser failed", createError);
    redirect(`${back}?paso=email&error=envio`);
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${await siteOrigin()}${back}`,
    },
  });
  if (error) {
    console.error("requestInvitationLink: signInWithOtp failed", error);
    redirect(`${back}?paso=email&error=envio`);
  }
  await rememberCodeEmail(email);
  redirect(`${back}?paso=enviado`);
}

// Signed in: link the account to the person.
export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const back = `/invitacion/${encodeURIComponent(token)}`;
  if (formData.get("consent") !== "on") {
    redirect(`${back}?error=consentimiento`);
  }

  const supabase = await createClient();
  const { data: slug, error } = await supabase.rpc("accept_invitation", {
    p_token: token,
  });
  if (error) redirect(`${back}?error=${errorCode(error.message)}`);
  redirect(slug ? `/persona/${slug}?bienvenida=1` : "/");
}

// «No soy yo»: goes to the review queue, optionally with the right name.
export async function disputeInvitation(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const back = `/invitacion/${encodeURIComponent(token)}`;
  const supabase = await createClient();
  await supabase.rpc("dispute_invitation", {
    p_token: token,
    p_suggested_name: String(formData.get("name") ?? ""),
  });
  redirect(`${back}?paso=gracias`);
}

// «Este soy yo» on a person page.
export async function claimPerson(formData: FormData) {
  const personId = String(formData.get("personId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_person", {
    p_person_id: personId,
  });
  if (error) {
    redirect(`/persona/${slug}?error=${errorCode(error.message)}`);
  }
  redirect(`/persona/${slug}?bienvenida=1`);
}
