"use server";

import { createClient as createAnonClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";
import { newInvitationToken } from "@/lib/invitations";
import { siteOrigin } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, requireAdmin } from "@/lib/supabase/server";

// /admin/usuarios. Role and block changes go through SECURITY DEFINER functions that check
// the caller is an admin; the «at least one admin» rule is a database trigger.

const PATH = "/admin/usuarios";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function target(formData: FormData): string {
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) redirect(`${PATH}?error=1`);
  return id;
}

// Back to the tab the form was on, with an optional «error=…» or «ok=…». Role and block
// changes can also be made from a person's admin page («persona» = their id): back there.
function back(formData: FormData, query = ""): never {
  const persona = String(formData.get("persona") ?? "");
  if (UUID.test(persona)) {
    redirect(`/admin/personas/${persona}${query ? `?${query}` : ""}`);
  }
  const lista = formData.get("lista");
  const list =
    lista === "usuarios" || lista === "solicitudes" ? `lista=${lista}&` : "";
  redirect(`${PATH}?${list}${query}`);
}

function failure(error: { message: string } | null): string {
  if (!error) return "";
  return error.message.includes("at least one admin")
    ? "error=ultimo"
    : "error=1";
}

async function setRole(formData: FormData, role: "admin" | "user") {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", {
    p_user_id: target(formData),
    p_role: role,
  });
  revalidatePath(PATH, "layout");
  back(formData, failure(error));
}

export async function makeAdmin(formData: FormData) {
  await setRole(formData, "admin");
}

export async function removeAdmin(formData: FormData) {
  await setRole(formData, "user");
}

async function setBlocked(formData: FormData, blocked: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_blocked", {
    p_user_id: target(formData),
    p_blocked: blocked,
  });
  revalidatePath(PATH);
  back(formData, failure(error));
}

export async function blockUser(formData: FormData) {
  await setBlocked(formData, true);
}

export async function unblockUser(formData: FormData) {
  await setBlocked(formData, false);
}

// ---------------------------------------------------------------------------
// Admin invitations: an invitation with role 'admin', bound to the email it is sent to.
// Accepting it (the usual /invitacion/[token] page) promotes the account.
// ---------------------------------------------------------------------------

export type InviteResult =
  { ok: true; url: string; emailed: boolean } | { ok: false; error: string };

export async function inviteAdmin(rawEmail: string): Promise<InviteResult> {
  const admin = await requireAdmin();
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { ok: false, error: "Escribe un email válido." };
  }

  const supabase = await createClient();
  const { data: users } = await supabase.rpc("admin_user_list");
  const existing = users?.find((u) => u.email?.toLowerCase() === email);
  if (existing?.role === "admin" && !existing.blocked_at) {
    return { ok: false, error: "Esa cuenta ya es admin." };
  }

  const { token, hash } = newInvitationToken();
  const { error } = await supabase.from("invitations").insert({
    token_hash: hash,
    role: "admin",
    email,
    invited_by: admin.id,
  });
  if (error) return { ok: false, error: "No se pudo crear la invitación." };

  const url = `${await siteOrigin()}/invitacion/${token}`;
  revalidatePath(PATH);
  return { ok: true, url, emailed: await sendInvitationEmail(email, url) };
}

// «Reenviar»: a new link (only the hash of the old one is stored) and 7 more days. For the
// invitations sent by email: admin invitations and approved access requests (no person).
export async function resendInvitation(formData: FormData) {
  await requireAdmin();
  const id = target(formData);
  const supabase = await createClient();
  const { token, hash } = newInvitationToken();
  const { data: invitation } = await supabase
    .from("invitations")
    .update({
      token_hash: hash,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    })
    .eq("id", id)
    .is("person_id", null)
    .is("accepted_at", null)
    .select("email")
    .maybeSingle();
  if (!invitation?.email) back(formData, "error=1");

  const sent = await sendInvitationEmail(
    invitation.email,
    `${await siteOrigin()}/invitacion/${token}`,
  );
  revalidatePath(PATH);
  back(formData, sent ? "ok=reenviada" : "error=envio");
}

export async function cancelInvitation(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase
    .from("invitations")
    .update({ expires_at: new Date().toISOString() })
    .eq("id", target(formData))
    .is("accepted_at", null);
  revalidatePath(PATH);
  redirect(PATH);
}

// ---------------------------------------------------------------------------
// Access requests («Pide acceso», /registro). Approving creates a user invitation bound to
// the email and sends it like an admin invitation.
// ---------------------------------------------------------------------------

export async function approveAccessRequest(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { token, hash } = newInvitationToken();
  const { data: email, error } = await supabase.rpc("approve_access_request", {
    p_id: target(formData),
    p_token_hash: hash,
  });
  revalidatePath(PATH, "layout");
  if (error || !email) back(formData, "error=1");

  const sent = await sendInvitationEmail(
    email,
    `${await siteOrigin()}/invitacion/${token}`,
  );
  back(formData, sent ? "ok=aprobada" : "error=envio");
}

export async function rejectAccessRequest(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_access_request", {
    p_id: target(formData),
  });
  revalidatePath(PATH, "layout");
  back(formData, error ? "error=1" : "");
}

// Sign-ups are disabled, so the account is created first (no-op if it exists) and then
// emailed a magic link that lands on the invitation. A plain client without cookies sends
// it, so the admin's own session is not touched.
async function sendInvitationEmail(
  email: string,
  url: string,
): Promise<boolean> {
  const { error: createError } =
    await createAdminClient().auth.admin.createUser({
      email,
      email_confirm: true,
    });
  if (createError && createError.code !== "email_exists") {
    console.error("sendInvitationEmail: createUser failed", createError);
    return false;
  }
  const mailer = createAnonClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await mailer.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: url },
  });
  if (error) console.error("sendInvitationEmail: signInWithOtp failed", error);
  return !error;
}
