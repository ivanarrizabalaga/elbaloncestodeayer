import Link from "next/link";
import { INSTAGRAM_URL, YOUTUBE_URL } from "@/lib/site";

const linkClass =
  "inline-flex min-h-11 items-center underline-offset-4 hover:text-fg hover:underline";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-x-8 gap-y-4 px-4 py-8 text-sm text-muted sm:px-6">
        <p className="max-w-xl">
          Un archivo para compartir, no para vender. Empezó con una colección
          personal y crece con lo que aporta cada uno.
        </p>
        <nav aria-label="Pie" className="flex flex-wrap gap-x-6">
          <Link href="/privacidad" className={linkClass}>
            Privacidad
          </Link>
          <a href={INSTAGRAM_URL} className={linkClass}>
            Instagram
          </a>
          <a href={YOUTUBE_URL} className={linkClass}>
            YouTube
          </a>
        </nav>
      </div>
    </footer>
  );
}
