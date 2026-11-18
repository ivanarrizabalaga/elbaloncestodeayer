"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Admin sections. Only the ones that exist; the rest arrive in later phases.
// The badge on «Usuarios y admins» counts pending access requests.
export function AdminNav({
  pending,
  requests,
}: {
  pending: number;
  requests: number;
}) {
  const pathname = usePathname();
  const links = [
    { href: "/admin/pendiente", label: "Pendiente", badge: pending },
    { href: "/admin/subir", label: "Subir fotos", badge: 0 },
    {
      href: "/admin/usuarios",
      label: "Usuarios y admins",
      badge: requests,
      query: requests > 0 ? "?lista=solicitudes" : "",
    },
  ];
  return (
    <nav aria-label="Administración" className="border-b border-line">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-4 sm:px-6">
        <span className="mr-2 rounded-full bg-surface-3 px-2.5 py-0.5 text-xs font-semibold tracking-[0.08em] text-accent uppercase">
          Admin
        </span>
        {links.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={`${link.href}${"query" in link ? link.query : ""}`}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap ${
                active
                  ? "border-accent text-fg"
                  : "border-transparent text-muted hover:text-fg"
              }`}
            >
              {link.label}
              {link.badge > 0 && (
                <span className="rounded-full bg-accent px-2 text-xs font-bold text-on-accent">
                  {link.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
