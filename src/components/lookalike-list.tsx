import Link from "next/link";
import type { Lookalike } from "@/lib/lookalikes";
import { photoSrc } from "@/lib/photos";

// «Parecida a:» and the photos that look the same, one per line, each linking to its admin
// page. Used in the drafts table and on a photo's admin page.
export function LookalikeList({
  items,
  className = "",
}: {
  items: Lookalike[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={`flex flex-col items-start gap-1.5 text-xs ${className}`}>
      <span className="font-semibold text-accent">Parecida a:</span>
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/admin/fotos/${item.id}`}
          className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-md border border-line-strong py-1 pr-2.5 pl-1 break-all"
        >
          {item.storage_key && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoSrc(item.storage_key, "thumb")}
              alt=""
              loading="lazy"
              className="h-8 w-12 rounded object-cover"
            />
          )}
          {item.label}
        </Link>
      ))}
    </div>
  );
}
