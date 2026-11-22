import { ImageResponse } from "next/og";

// The site's icon (favicon, home screen, PWA): an orange ball on the dark background.
// Same values as --color-bg and --color-accent in globals.css.
export const ICON_BG = "#0e0e0e";
const ACCENT = "#ff7a1a";

// `radius` is the ball's radius as a % of the icon. Home-screen icons keep it within the
// central 80% that Android masks may crop to; the favicon fills more of its few pixels.
export function appIcon(size: number, radius: number) {
  const c = 50;
  const d = radius * Math.SQRT1_2; // seam ends, at 45° from the centre
  const bend = radius * 0.28; // how far the side seams curve in
  const seams = [
    `M ${c} ${c - radius} V ${c + radius}`,
    `M ${c - radius} ${c} H ${c + radius}`,
    `M ${c - d} ${c - d} Q ${c - bend} ${c} ${c - d} ${c + d}`,
    `M ${c + d} ${c - d} Q ${c + bend} ${c} ${c + d} ${c + d}`,
  ];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: ICON_BG,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx={c} cy={c} r={radius} fill={ACCENT} />
        {seams.map((path) => (
          <path
            key={path}
            d={path}
            fill="none"
            stroke={ICON_BG}
            strokeWidth={3}
          />
        ))}
      </svg>
    </div>,
    { width: size, height: size },
  );
}
