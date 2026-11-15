import Link from "next/link";
import { countOpenReviewItems } from "@/lib/review";
import { initials } from "@/lib/site";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const pending = user?.isAdmin
    ? await countOpenReviewItems(await createClient())
    : 0;

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <Link
          href="/"
          className="flex min-h-11 items-center font-display text-xl font-bold uppercase tracking-wide"
        >
          El baloncesto <span className="ml-1 text-accent">de ayer</span>
        </Link>

        {user ? (
          <div className="flex items-center gap-3 text-sm">
            {user.isAdmin && (
              <Link
                href="/admin/pendiente"
                className="flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 font-semibold text-on-accent"
              >
                Admin
                {pending > 0 && (
                  <span className="rounded-full bg-bg px-2 text-xs font-bold text-accent">
                    <span className="sr-only">, pendientes: </span>
                    {pending}
                  </span>
                )}
              </Link>
            )}
            {!user.isAdmin && !user.isBlocked && (
              <Link
                href="/proponer"
                className="flex min-h-11 items-center rounded-full bg-accent px-4 font-semibold text-on-accent"
              >
                Proponer foto
              </Link>
            )}
            <Link
              href="/cuenta"
              aria-label="Mi cuenta"
              className="flex min-h-11 items-center gap-2 rounded-full text-muted hover:text-fg"
            >
              <span
                aria-hidden="true"
                className="flex size-9 items-center justify-center rounded-full bg-[#2e2e2e] text-[13px] font-semibold text-fg"
              >
                {initials(user.displayName ?? user.email ?? "?")}
              </span>
              <span className="hidden sm:inline">
                {user.displayName ?? "Mi cuenta"}
              </span>
            </Link>
          </div>
        ) : (
          <Link
            href="/entrar"
            className="flex min-h-11 items-center rounded-full border border-line-strong px-4 text-sm font-semibold"
          >
            Entrar
          </Link>
        )}
      </div>
    </header>
  );
}
