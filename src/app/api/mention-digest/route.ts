import { sendMentionDigest } from "@/lib/mention-digest";

// Called once a day by Vercel Cron (vercel.json): the mention emails (src/lib/mention-digest.ts).
// Vercel sends "Authorization: Bearer <CRON_SECRET>".
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response("CRON_SECRET is not set", { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Links in the emails go to the public domain, not to whatever host the cron called.
  const origin =
    process.env.VERCEL_ENV === "production"
      ? "https://elbaloncestodeayer.com"
      : new URL(request.url).origin;
  const result = await sendMentionDigest(origin);
  return Response.json(result);
}
