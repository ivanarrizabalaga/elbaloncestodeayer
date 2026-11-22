import "server-only";
import { cookies } from "next/headers";

// The email a sign-in code was sent to, so the code form only asks for the code. It lives
// as long as the code (otp_expiry in supabase/config.toml).
const COOKIE = "codigo_email";

// ?error= values verifyCode redirects with (besides «espera»).
export const CODE_ERRORS: Record<string, string> = {
  codigo: "Ese código no es válido. Revisa los 6 números del último email.",
  codigo_caducado: "El código ha caducado. Pide uno nuevo.",
};

export async function rememberCodeEmail(email: string) {
  (await cookies()).set(COOKIE, email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
}

export async function codeEmail(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE)?.value;
}

export async function forgetCodeEmail() {
  (await cookies()).delete(COOKIE);
}
