import Link from "next/link";
import { photoLabel, photoSrc } from "@/lib/photos";

export type GridPhoto = {
  id: string;
  slug: string;
  team: string | null;
  season_label: string | null;
  storage_key: string | null;
  width: number | null;
  height: number | null;
  // Optional line under the thumbnail, e.g. «Liga provincial · 8 etiquetados».
  caption?: string;
  // Where the thumbnail links to; defaults to the public photo page.
  href?: string;
};

// Grid of photo thumbnails linking to /foto/[slug]. Used on photo, person and home pages.
export function PhotoGrid({ photos }: { photos: GridPhoto[] }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
      {photos.map((photo) => (
        <li key={photo.id}>
          <Link
            href={photo.href ?? `/foto/${photo.slug}`}
            className="group flex flex-col gap-2"
          >
            <span className="block aspect-[3/2] overflow-hidden rounded-md bg-surface-3">
              {photo.storage_key && (
                // Plain <img>: derivatives are generated at upload time (phase 3), not by Next.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoSrc(photo.storage_key, "thumb")}
                  width={photo.width ?? undefined}
                  height={photo.height ?? undefined}
                  alt={`Foto: ${photoLabel(photo)}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
                />
              )}
            </span>
            {photo.caption && (
              <span className="text-[13px] text-muted">{photo.caption}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
