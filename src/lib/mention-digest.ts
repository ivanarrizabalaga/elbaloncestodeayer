import "server-only";
import { escapeHtml, sendEmail } from "@/lib/email";
import { plainBody } from "@/lib/mentions";
import { photoLabel } from "@/lib/photos";
import { createAdminClient } from "@/lib/supabase/admin";

// The daily email for mentions in memories (SPEC §12), run by Vercel Cron through
// /api/mention-digest. Each person gets at most one email a day with everything pending.
// Resend's free tier (3,000/month, 100/day) is shared with the sign-in emails, which must
// never run out, so mentions get a budget: over it, or paused by an admin, they wait.

export const MONTHLY_BUDGET = 1500;
export const PER_RUN = 50;

// Calendar month in UTC (Resend's monthly quota may reset on another day: this is a budget,
// not an exact mirror of it).
export function monthStart(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

type Item = {
  memoryId: string;
  author: string;
  photoLabel: string;
  photoSlug: string;
  text: string;
};

export type DigestResult = {
  sent: number;
  skipped: number;
  stopped?: "paused" | "budget" | "quota" | "error";
};

export async function sendMentionDigest(origin: string): Promise<DigestResult> {
  // Runs without a signed-in user: the secret key, only here (see CLAUDE.md).
  const admin = createAdminClient();

  const { data: settings } = await admin
    .from("mention_settings")
    .select("paused")
    .maybeSingle();
  if (settings?.paused) return { sent: 0, skipped: 0, stopped: "paused" };

  const { count: sentThisMonth } = await admin
    .from("mention_emails")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", monthStart());
  const room = Math.min(PER_RUN, MONTHLY_BUDGET - (sentThisMonth ?? 0));
  if (room <= 0) return { sent: 0, skipped: 0, stopped: "budget" };

  // Pending mentions, oldest first. Hidden memories and unpublished photos wait.
  const { data: pending, error } = await admin
    .from("memory_mentions")
    .select(
      "memory_id, profile_id, memory:memories!inner(body, hidden_at, author_id, photo:photos!inner(slug, status, team, team_2, season_label))",
    )
    .is("notified_at", null)
    .is("memory.hidden_at", null)
    .eq("memory.photo.status", "published")
    .order("created_at")
    .limit(1000);
  if (error) {
    console.error("sendMentionDigest: pending", error);
    return { sent: 0, skipped: 0, stopped: "error" };
  }

  // Group by person, keeping the order of their oldest mention.
  const byProfile = new Map<string, NonNullable<typeof pending>>();
  for (const row of pending ?? []) {
    byProfile.set(row.profile_id, [
      ...(byProfile.get(row.profile_id) ?? []),
      row,
    ]);
  }
  const recipients = [...byProfile.keys()].slice(0, room);
  if (recipients.length === 0) return { sent: 0, skipped: 0 };

  const authorIds = [
    ...new Set(
      recipients.flatMap((id) =>
        byProfile
          .get(id)!
          .flatMap((r) => (r.memory.author_id ? [r.memory.author_id] : [])),
      ),
    ),
  ];
  const [{ data: profiles }, { data: authors }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, display_name, mention_emails, blocked_at")
      .in("id", recipients),
    admin.from("profiles").select("id, display_name").in("id", authorIds),
  ]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const authorName = new Map(
    (authors ?? []).map((a) => [a.id, a.display_name]),
  );

  let sent = 0;
  let skipped = 0;
  for (const profileId of recipients) {
    const rows = byProfile.get(profileId)!;
    const memoryIds = rows.map((r) => r.memory_id);
    const markNotified = () =>
      admin
        .from("memory_mentions")
        .update({ notified_at: new Date().toISOString() })
        .eq("profile_id", profileId)
        .in("memory_id", memoryIds);

    const profile = profileById.get(profileId);
    const { data: user } = await admin.auth.admin.getUserById(profileId);
    const email = user.user?.email;
    // Opted out, blocked or without an email: never sent, not even later.
    if (!profile || !profile.mention_emails || profile.blocked_at || !email) {
      await markNotified();
      skipped++;
      continue;
    }

    const items: Item[] = rows.map((r) => ({
      memoryId: r.memory_id,
      author:
        (r.memory.author_id && authorName.get(r.memory.author_id)) || "Alguien",
      photoLabel: photoLabel(r.memory.photo),
      photoSlug: r.memory.photo.slug,
      text: plainBody(r.memory.body),
    }));
    const result = await sendEmail({
      to: email,
      ...mentionEmail(profile.display_name, items, origin),
    });
    if (result === "quota") return { sent, skipped, stopped: "quota" };
    if (result === "error") continue; // Stays pending for tomorrow.

    await markNotified();
    await admin
      .from("mention_emails")
      .insert({ profile_id: profileId, mentions: rows.length });
    sent++;
    // Resend allows a few requests per second.
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return { sent, skipped };
}

// «Juan te ha mencionado en un recuerdo» / «Juan y Ana te han mencionado en 3 recuerdos».
export function mentionEmail(
  name: string | null,
  items: Item[],
  origin: string,
): { subject: string; html: string; text: string } {
  const authors = [...new Set(items.map((i) => i.author))];
  const who =
    authors.length === 1
      ? authors[0]
      : authors.length === 2
        ? `${authors[0]} y ${authors[1]}`
        : `${authors[0]}, ${authors[1]} y más gente`;
  const verb = authors.length === 1 ? "te ha mencionado" : "te han mencionado";
  const where =
    items.length === 1 ? "en un recuerdo" : `en ${items.length} recuerdos`;
  const subject = `${who} ${verb} ${where}`;
  const greeting = name ? `Hola, ${name.split(" ")[0]}:` : "Hola:";
  const account = `${origin}/cuenta`;
  const snippet = (text: string) =>
    text.length > 280 ? `${text.slice(0, 277).trimEnd()}…` : text;

  const text = [
    greeting,
    "",
    `${subject} en El baloncesto de ayer.`,
    "",
    ...items.flatMap((i) => [
      `${i.author}, en la foto «${i.photoLabel}»:`,
      `«${snippet(i.text)}»`,
      `${origin}/foto/${i.photoSlug}#historia`,
      "",
    ]),
    "¿Te acuerdas de algo más? Puedes añadir tu propio recuerdo en cada foto.",
    "",
    `Recibes este email porque tienes cuenta en El baloncesto de ayer. Si no quieres más avisos de menciones, desactívalos en ${account}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:32px 16px;background:#0e0e0e;color:#f2f2f2;font-family:Inter,Arial,sans-serif">
    <div style="max-width:480px;margin:0 auto">
      <p style="margin:0 0 24px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:#ff7a1a;font-weight:700">El baloncesto de ayer</p>
      <h1 style="margin:0 0 16px;font-size:24px">${escapeHtml(subject)}</h1>
      <p style="margin:0 0 24px;line-height:1.6;color:#a6a6a6">${escapeHtml(greeting)} alguien se ha acordado de ti al contar la historia de una foto.</p>
      ${items
        .map(
          (
            i,
          ) => `<div style="margin:0 0 20px;padding:16px;border-radius:12px;background:#1a1a1a">
        <p style="margin:0 0 8px;font-size:14px;color:#a6a6a6">${escapeHtml(i.author)}, en la foto <strong style="color:#f2f2f2">${escapeHtml(i.photoLabel)}</strong>:</p>
        <p style="margin:0 0 14px;line-height:1.6;white-space:pre-line">«${escapeHtml(snippet(i.text))}»</p>
        <a href="${escapeHtml(`${origin}/foto/${i.photoSlug}#historia`)}" style="display:inline-block;padding:10px 20px;border-radius:999px;background:#ff7a1a;color:#0e0e0e;font-weight:700;text-decoration:none">Ver la foto</a>
      </div>`,
        )
        .join("\n      ")}
      <p style="margin:8px 0 32px;line-height:1.6;color:#a6a6a6">¿Te acuerdas de algo más? Puedes añadir tu propio recuerdo en cada foto.</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#a6a6a6">Recibes este email porque tienes cuenta en El baloncesto de ayer. Si no quieres más avisos de menciones, <a href="${escapeHtml(account)}" style="color:#a6a6a6">desactívalos en tu cuenta</a>.</p>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}
