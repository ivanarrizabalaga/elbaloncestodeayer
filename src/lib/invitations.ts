import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { CODE_ERRORS } from "./code-email";

// The link carries a random token; the database only keeps its SHA-256 (hex), the same hash
// public.invitation_token_hash() computes.
export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newInvitationToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashInvitationToken(token) };
}

// Messages for the errors raised by the SQL functions (accept_invitation, claim_person…).
export const INVITATION_ERRORS: Record<string, string> = {
  invitation_not_found: "Esta invitación no existe.",
  invitation_used: "Esta invitación ya se ha usado.",
  invitation_expired:
    "Esta invitación ha caducado. Pide a quien te la mandó un enlace nuevo.",
  person_already_claimed: "Otra cuenta ya está enlazada con esta persona.",
  account_already_linked:
    "Tu cuenta ya está enlazada con otra persona del archivo.",
  invitation_other_email:
    "Esta invitación es para otro email. Sal y entra con el email al que llegó.",
  not_allowed: "Tu cuenta no puede hacer esto ahora mismo.",
  consentimiento: "Para seguir, marca la casilla de consentimiento.",
  email: "Escribe un email válido.",
  email_otra: "Esta invitación ya se está usando con otro email.",
  envio: "No se pudo enviar el enlace. Inténtalo en un minuto.",
  espera:
    "Has hecho varios intentos seguidos. Espera un minuto y vuelve a intentarlo.",
  ...CODE_ERRORS,
};

export function errorCode(message: string | undefined): string {
  return message && message in INVITATION_ERRORS ? message : "not_allowed";
}
