import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-x-8 gap-y-4 px-4 py-8 text-sm text-muted sm:px-6">
        <p className="max-w-xl">
          Un archivo para compartir, no para vender. Empezó con una colección
          personal y crece con lo que aporta cada uno.
        </p>
        <nav aria-label="Pie" className="flex flex-wrap gap-x-6">
          <Link
            href="/privacidad"
            className="inline-flex min-h-11 items-center underline-offset-4 hover:text-fg hover:underline"
          >
            Privacidad
          </Link>
          <a
            href="https://www.instagram.com/explore/tags/elbaloncestodeayer/"
            className="inline-flex min-h-11 items-center underline-offset-4 hover:text-fg hover:underline"
          >
            #elbaloncestodeayer en Instagram
          </a>
        </nav>
      </div>
    </footer>
  );
}
