"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type Props = { previousHref: string | null; nextHref: string | null };

// Under the photo: previous/next in the gallery list the photo was opened from.
// Swipe on the strip (not on the photo, where a tap tags a face), tap the arrows,
// or use ← → on a keyboard. It stops at both ends of the list.
export function PhotoStepper({ previousHref, nextHref }: Props) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      // Not while typing, nor with the full-size photo open.
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("input, textarea, select, [contenteditable]")
      ) {
        return;
      }
      if (document.querySelector("dialog[open]")) return;
      const href =
        event.key === "ArrowLeft"
          ? previousHref
          : event.key === "ArrowRight"
            ? nextHref
            : null;
      if (href) router.push(href);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previousHref, nextHref, router]);

  if (!previousHref && !nextHref) return null;

  function onPointerUp(event: React.PointerEvent) {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    // Finger moves left: the next photo comes in from the right.
    const href = dx < 0 ? nextHref : previousHref;
    if (href) router.push(href);
  }

  return (
    <nav
      aria-label="Pasar de foto"
      onPointerDown={(event) => {
        start.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null;
      }}
      className="flex touch-pan-y items-center justify-between rounded-lg bg-surface-2 select-none"
    >
      <Step href={previousHref} rel="prev">
        <ChevronIcon left />
        Anterior
      </Step>
      <span aria-hidden="true" className="text-[13px] text-muted">
        <span className="pointer-fine:hidden">Desliza</span>
        <span className="hidden pointer-fine:inline">← →</span>
      </span>
      <Step href={nextHref} rel="next">
        Siguiente
        <ChevronIcon />
      </Step>
    </nav>
  );
}

function Step({
  href,
  rel,
  children,
}: {
  href: string | null;
  rel: "prev" | "next";
  children: React.ReactNode;
}) {
  const className = "inline-flex h-12 items-center gap-1.5 px-4 font-medium";
  // At either end of the list: shown dimmed so the strip keeps its shape.
  if (!href) {
    return (
      <span aria-hidden="true" className={`${className} text-muted opacity-40`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} rel={rel} draggable={false} className={className}>
      {children}
    </Link>
  );
}

function ChevronIcon({ left = false }: { left?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d={left ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}
