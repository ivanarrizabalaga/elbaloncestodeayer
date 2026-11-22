"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

export type Neighbour = { href: string; src: string | null } | null;

type Props = {
  previous: Neighbour;
  next: Neighbour;
  // Off while tagging: then a tap on the photo picks a face.
  enabled: boolean;
  children: ReactNode;
};

// Swipe the photo to pass to the previous/next one, card style: the photo follows the
// finger, tilting a little, and the neighbour shows underneath. Let go past a quarter of
// the width (or with a quick flick) and it flies off; otherwise it springs back. At either
// end of the list it only gives a little. Vertical scrolling and pinch-zoom are left alone.
// Give it a `key` per photo, so a new photo starts in place.
export function PhotoSwipe({ previous, next, enabled, children }: Props) {
  const router = useRouter();
  const card = useRef<HTMLDivElement>(null);
  const under = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    active: boolean;
    dx: number;
    // Recent position, for the flick speed.
    lastX: number;
    lastT: number;
    speed: number;
  } | null>(null);
  // A drag ends with a click on whatever it started on (a tag, a button): swallow it.
  const swallowClick = useRef(false);
  const [peek, setPeek] = useState<"previous" | "next" | null>(null);

  function place(dx: number, animate: boolean) {
    const width = card.current?.offsetWidth || 1;
    const transition = animate ? "transform 220ms ease-out" : "none";
    if (card.current) {
      card.current.style.transition = transition;
      card.current.style.transform = dx
        ? `translateX(${dx}px) rotate(${(dx / width) * 6}deg)`
        : "";
    }
    if (under.current) {
      const progress = Math.min(Math.abs(dx) / width, 1);
      under.current.style.transition = transition;
      under.current.style.transform = `scale(${0.92 + 0.08 * progress})`;
    }
  }

  function onPointerDown(event: React.PointerEvent) {
    swallowClick.current = false;
    if (!enabled || !event.isPrimary || event.button !== 0) return;
    // The full-size photo is a <dialog> inside the card in React's tree: not a swipe.
    if (event.target instanceof Element && event.target.closest("dialog")) {
      return;
    }
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      active: false,
      dx: 0,
      lastX: event.clientX,
      lastT: event.timeStamp,
      speed: 0,
    };
    // Have the neighbour pages ready by the time the finger lets go.
    if (previous) router.prefetch(previous.href);
    if (next) router.prefetch(next.href);
  }

  function onPointerMove(event: React.PointerEvent) {
    const d = drag.current;
    if (!d || event.pointerId !== d.id) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (!d.active) {
      // Mostly vertical: a scroll, not ours.
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        drag.current = null;
        return;
      }
      if (Math.abs(dx) < 10) return;
      d.active = true;
      card.current?.setPointerCapture(event.pointerId);
    }
    const target = dx < 0 ? next : previous;
    setPeek(target ? (dx < 0 ? "next" : "previous") : null);
    // At either end of the list, resist.
    d.dx = target ? dx : dx * 0.25;
    const dt = event.timeStamp - d.lastT;
    if (dt > 0) d.speed = (event.clientX - d.lastX) / dt;
    d.lastX = event.clientX;
    d.lastT = event.timeStamp;
    place(d.dx, false);
  }

  function onPointerUp(event: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d || event.pointerId !== d.id || !d.active) return;
    swallowClick.current = true;

    const width = card.current?.offsetWidth || 1;
    const target = d.dx < 0 ? next : previous;
    const flick =
      Math.abs(d.speed) > 0.5 && Math.sign(d.speed) === Math.sign(d.dx);
    if (target && (Math.abs(d.dx) > width / 4 || flick)) {
      // Off it goes; the neighbour, already underneath, stays until the new page arrives.
      const still = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      place(Math.sign(d.dx) * width * 1.5, !still);
      router.replace(target.href);
      return;
    }
    place(0, true);
  }

  function onPointerCancel() {
    if (drag.current?.active) place(0, true);
    drag.current = null;
  }

  return (
    <div className="relative">
      {(previous || next) && (
        <div
          ref={under}
          aria-hidden="true"
          // Nothing underneath at either end of the list.
          className={`absolute inset-0 overflow-hidden rounded-lg bg-surface-3 ${peek ? "" : "invisible"}`}
        >
          {/* Both loaded up front, so they are there when swiping (and cached for the next page). */}
          {[previous, next].map(
            (neighbour, i) =>
              neighbour?.src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={neighbour.src}
                  src={neighbour.src}
                  alt=""
                  draggable={false}
                  className={`absolute inset-0 h-full w-full object-contain ${
                    peek === (i === 0 ? "previous" : "next") ? "" : "invisible"
                  }`}
                />
              ),
          )}
        </div>
      )}
      <div
        ref={card}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={(event) => {
          if (swallowClick.current) {
            swallowClick.current = false;
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onTransitionEnd={(event) => {
          // Back in place: hide the neighbour again.
          if (event.target === card.current && !card.current.style.transform) {
            setPeek(null);
          }
        }}
        // With a mouse, the browser would start dragging the image instead.
        onDragStart={(event) => event.preventDefault()}
        className="relative origin-bottom touch-pan-y touch-pinch-zoom select-none"
      >
        {children}
      </div>
    </div>
  );
}
