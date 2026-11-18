"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

type NavigationApi = { canGoBack: boolean };

// «Volver»: back to the previous page of this site, like the browser's back button (keeps
// its scroll and filters). When there is none (someone arrived from a WhatsApp link, or a
// browser without the Navigation API), it is a normal link to `fallback`.
// navigation.canGoBack only counts this site's own history entries, so it never sends
// anyone back out of the site.
export function BackLink({
  fallback,
  className,
  children,
}: {
  fallback: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <Link
      href={fallback}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        const navigation = (window as Window & { navigation?: NavigationApi })
          .navigation;
        if (navigation?.canGoBack) {
          event.preventDefault();
          router.back();
        }
      }}
    >
      {children}
    </Link>
  );
}
