import "server-only";

// Emails the app sends itself (today only the mention digest; sign-in emails are Supabase's).
// Production: Resend's API with RESEND_API_KEY, from the same domain as the sign-in emails.
// Local development without a key: the local Supabase's Mailpit (http://127.0.0.1:54324).

const FROM = "El baloncesto de ayer <no-reply@mail.elbaloncestodeayer.com>";
const MAILPIT = "http://127.0.0.1:54324/api/v1/send";

export type Email = { to: string; subject: string; html: string; text: string };

// ok: sent. quota: Resend refused it for the daily or monthly quota (stop for today).
export type SendResult = "ok" | "quota" | "error";

export async function sendEmail(email: Email): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (key) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, ...email }),
    });
    if (response.ok) return "ok";
    const body = await response.text();
    console.error("sendEmail: Resend", response.status, body);
    // 429 is also the per-second rate limit; only the quotas mean «no more today».
    return response.status === 429 && body.includes("quota_exceeded")
      ? "quota"
      : "error";
  }

  if (process.env.NODE_ENV === "production") {
    console.error("sendEmail: RESEND_API_KEY is not set");
    return "error";
  }
  const response = await fetch(MAILPIT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      From: {
        Email: "no-reply@mail.elbaloncestodeayer.com",
        Name: "El baloncesto de ayer",
      },
      To: [{ Email: email.to }],
      Subject: email.subject,
      HTML: email.html,
      Text: email.text,
    }),
  });
  if (!response.ok) console.error("sendEmail: Mailpit", response.status);
  return response.ok ? "ok" : "error";
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
