import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Target of the magic link in the email (supabase/templates/magic-link.html).
// Verifies the token_hash and starts the session. Works even if the email is opened
// in a different browser from the one where the link was requested.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"), request.nextUrl.origin);

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/entrar?error=enlace", request.url));
}

// Only allow redirects within this site. `next` is a path, or the absolute redirect URL the
// email template adds ({{ .RedirectTo }}, e.g. back to an invitation).
function safeNext(next: string | null, origin: string): string {
  if (!next) return "/";
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  try {
    const url = new URL(next);
    if (url.origin === origin) return `${url.pathname}${url.search}`;
  } catch {
    // Not a URL.
  }
  return "/";
}
