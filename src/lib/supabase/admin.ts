import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";
import type { Database } from "./database.types";

// Bypasses RLS. Only two uses in the app:
// - creating the account of someone who is invited (accepting a user invitation, or an admin
//   invitation being sent), since sign-ups are disabled. Validate the invitation (or the
//   admin) first;
// - the daily mention digest (src/lib/mention-digest.ts), run by Vercel Cron behind
//   CRON_SECRET with no signed-in user.
// Everything else goes through createClient() in ./server.ts.
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing environment variable SUPABASE_SECRET_KEY.");
  }
  return createClient<Database>(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
