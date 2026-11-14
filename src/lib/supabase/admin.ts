import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";
import type { Database } from "./database.types";

// Bypasses RLS. Its only use in the app: creating the account of someone accepting an
// invitation (sign-ups are disabled, accounts exist only by invitation). Always validate the
// invitation first. Everything else goes through createClient() in ./server.ts.
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing environment variable SUPABASE_SECRET_KEY.");
  }
  return createClient<Database>(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
