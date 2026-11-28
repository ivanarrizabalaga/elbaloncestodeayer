"use client";

import { useState } from "react";

// Shares the link through the system share sheet (Telegram, Messages, email…), with its
// preview. Where there is no share sheet, copies the link instead.
export function LinkShare({
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
        className={`inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line-strong px-5.5 font-semibold text-fg hover:border-fg ${className}`}
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
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <path d="m16 6-4-4-4 4" />
          <path d="M12 2v13" />
        </svg>
        Compartir
      </button>
      <p role="status" className="text-[13px] text-muted">
        {copied && "Enlace copiado."}
      </p>
    </div>
  );
}
