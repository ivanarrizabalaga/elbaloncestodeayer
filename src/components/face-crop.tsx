import type { ReactNode } from "react";

// A zoomed-in window on a photo, centred on a tag (x, y in 0–1).
// The image is ZOOM times wider than the frame; translate(%) uses the image's own size.
const ZOOM = 1 / 0.22;

export function FaceCrop({
  src,
  x,
  y,
  alt,
  className = "",
  children,
}: {
  src: string;
  x: number;
  y: number;
  // Empty string when the crop is decorative.
  alt: string;
  // Sizing and shape of the frame (aspect ratio, width, radius).
  className?: string;
  // Overlays: caption, «?» badge…
  children?: ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden bg-surface-3 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="absolute top-[40%] left-1/2 max-w-none"
        style={{
          width: `${ZOOM * 100}%`,
          transform: `translate(-${x * 100}%, -${y * 100}%)`,
        }}
      />
      {children}
    </div>
  );
}
