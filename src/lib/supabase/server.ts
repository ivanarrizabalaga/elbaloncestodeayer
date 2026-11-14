import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";
import type { Database } from "./database.types";

// Supabase client for Server Components, Server Actions and Route Handlers.
// Acts as the signed-in user, so every query goes through RLS.
// Create a new one per request; never share it.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. That is fine: the proxy refreshes the session.
        }
      },
    },
  });
}

export type CurrentUser = {
  id: string;
  email: string | undefined;
  displayName: string | null;
  isAdmin: boolean;
};

// The signed-in user, or null for visitors. Validates the JWT (getClaims), never trusts cookies blindly.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, blocked_at")
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    id: claims.sub,
    email: claims.email,
    displayName: profile?.display_name ?? null,
    isAdmin: profile?.role === "admin" && !profile.blocked_at,
  };
}

// For admin pages and Server Actions. Visitors go to sign in; signed-in non-admins get a 404
// (no hint that the page exists). RLS enforces the same rule on every write.
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  if (!user.isAdmin) notFound();
  return user;
}
