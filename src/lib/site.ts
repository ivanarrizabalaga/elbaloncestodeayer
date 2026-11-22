import "server-only";
import { headers } from "next/headers";

// The archive's public contact (forwarded to its Gmail, SPEC §11).
export const CONTACT_EMAIL = "hola@elbaloncestodeayer.com";

// The archive's own accounts (footer, privacy page).
export const INSTAGRAM_URL = "https://www.instagram.com/elbaloncestodeayer/";
export const YOUTUBE_URL = "https://www.youtube.com/@ElBaloncestoDeAyer";

// Absolute URL of this deployment, for share links (works locally, on previews and in production).
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// «Pepe Ferrán» -> «PF»
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
