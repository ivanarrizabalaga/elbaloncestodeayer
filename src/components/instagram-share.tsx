"use client";

import { useState } from "react";

// Instagram has no "share this link" URL like wa.me. On phones the system share
// sheet lists Instagram; where there is no share sheet, copy the link instead.
export function InstagramShare({
  text,
  url,
  className = "",
}: {
  text: string;
  url: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
      } catch {
        // Cancelled by the user: nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard blocked: nothing else we can do.
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={share}
        className={`inline-flex h-12 items-center justify-center gap-2 rounded-full bg-linear-to-r from-instagram-1 via-instagram-2 to-instagram-3 px-5.5 font-semibold text-white ${className}`}
      >
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
        </svg>
        Compartir en Instagram
      </button>
      <p role="status" className="text-[13px] text-muted">
        {copied && "Enlace copiado. Pégalo en Instagram."}
      </p>
    </div>
  );
}
