// Only allow redirects within this site. `next` is a path, or an absolute URL on this origin
// (e.g. the {{ .RedirectTo }} the email template adds, back to an invitation).
export function safePath(next: string | null, origin?: string): string {
  if (!next) return "/";
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  if (!origin) return "/";
  try {
    const url = new URL(next);
    if (url.origin === origin) return `${url.pathname}${url.search}`;
  } catch {
    // Not a URL.
  }
  return "/";
}
