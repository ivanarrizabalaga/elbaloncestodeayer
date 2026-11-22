import { ImageResponse } from "next/og";
import { ACCENT, Ball, ICON_BG } from "@/lib/app-icon";

// Launch screens for the app on an iPhone's home screen. iOS shows a blank screen unless
// there is an image for the exact screen size, so there is one per iPhone size (portrait,
// in CSS px and pixel ratio). Android draws its own from the manifest (icon only).
const SCREENS = [
  { width: 440, height: 956, ratio: 3 }, // 16 Pro Max, 17 Pro Max
  { width: 430, height: 932, ratio: 3 }, // 14 Pro Max, 15 Plus / Pro Max, 16 Plus
  { width: 428, height: 926, ratio: 3 }, // 12 / 13 Pro Max, 14 Plus
  { width: 420, height: 912, ratio: 3 }, // Air
  { width: 414, height: 896, ratio: 3 }, // XS Max, 11 Pro Max
  { width: 414, height: 896, ratio: 2 }, // XR, 11
  { width: 402, height: 874, ratio: 3 }, // 16 Pro, 17, 17 Pro
  { width: 393, height: 852, ratio: 3 }, // 14 Pro, 15, 15 Pro, 16
  { width: 390, height: 844, ratio: 3 }, // 12, 13, 14, 16e
  { width: 375, height: 812, ratio: 3 }, // X, XS, 11 Pro, 12 / 13 mini
  { width: 375, height: 667, ratio: 2 }, // SE, 8
];

// "1179x2556": the image size in device pixels, used as the URL segment.
export const SPLASH_SIZES = SCREENS.map(
  (s) => `${s.width * s.ratio}x${s.height * s.ratio}`,
);

// For metadata.appleWebApp.startupImage.
export const SPLASH_IMAGES = SCREENS.map((s, i) => ({
  url: `/splash/${SPLASH_SIZES[i]}`,
  media: `(device-width: ${s.width}px) and (device-height: ${s.height}px) and (-webkit-device-pixel-ratio: ${s.ratio}) and (orientation: portrait)`,
}));

const LINE_1 = "EL BALONCESTO";
const LINE_2 = "DE AYER";

export async function splashImage(width: number, height: number) {
  const font = await displayFont(LINE_1 + LINE_2);
  const fontSize = Math.round(width * 0.11);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: ICON_BG,
        color: "#f2f2f2",
        fontFamily: font ? "Barlow Condensed" : undefined,
        fontWeight: 700,
        fontSize,
        lineHeight: 1,
        letterSpacing: fontSize * 0.03,
      }}
    >
      <Ball size={Math.round(width * 0.42)} radius={46} />
      <div style={{ display: "flex", marginTop: fontSize * 0.6 }}>{LINE_1}</div>
      <div style={{ display: "flex", color: ACCENT }}>{LINE_2}</div>
    </div>,
    {
      width,
      height,
      fonts: font
        ? [{ name: "Barlow Condensed", data: font, weight: 700 }]
        : undefined,
    },
  );
}

// The site's display font, only the glyphs needed, from Google Fonts. The images are built
// once at build time; if the font cannot be fetched they fall back to the default font.
async function displayFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&text=${encodeURIComponent(text)}`,
    ).then((r) => r.text());
    const url = css.match(
      /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/,
    )?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}
