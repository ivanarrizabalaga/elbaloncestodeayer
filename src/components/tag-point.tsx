"use client";

import type { MouseEvent } from "react";

// Where a click landed on a photo, as 0–1 coordinates (what tags store).
export function pointFrom(event: MouseEvent<HTMLElement>) {
  const box = event.currentTarget.getBoundingClientRect();
  const round = (n: number) =>
    Math.min(1, Math.max(0, Math.round(n * 10000) / 10000));
  return {
    x: round((event.clientX - box.left) / box.width),
    y: round((event.clientY - box.top) / box.height),
  };
}

// The face being tagged, before it is saved.
export function PendingPoint({ point }: { point: { x: number; y: number } }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-accent/30"
      style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
    />
  );
}
