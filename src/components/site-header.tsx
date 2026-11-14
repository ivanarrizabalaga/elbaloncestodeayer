import Link from "next/link";
import { signOut } from "@/app/entrar/actions";
import { getCurrentUser } from "@/lib/supabase/server";

export async function SiteHeader() {
  const user = await getCurrentUser();

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
            <span className="hidden text-muted sm:inline">
              {user.displayName ?? user.email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="min-h-11 rounded-full border border-line-strong px-4 font-semibold"
              >
                Salir
              </button>
            </form>
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
