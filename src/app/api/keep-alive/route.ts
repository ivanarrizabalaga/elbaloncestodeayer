import { createClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

// Called once a day by Vercel Cron (vercel.json) so Supabase Free does not pause the project
// after a week without activity. Vercel sends "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response("CRON_SECRET is not set", { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // A light public read, as an anonymous visitor (goes through RLS).
  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false },
  });
  const { error } = await supabase
    .from("people")
    .select("id", { head: true, count: "exact" });

  if (error) {
    return new Response(`Supabase error: ${error.message}`, { status: 502 });
  }
  return new Response("ok");
}
