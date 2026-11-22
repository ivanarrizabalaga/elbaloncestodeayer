import { notFound } from "next/navigation";
import { SPLASH_SIZES, splashImage } from "@/lib/splash";

// iOS launch screens (see src/lib/splash.tsx), built at build time, one per iPhone size.
export const dynamicParams = false;

export function generateStaticParams() {
  return SPLASH_SIZES.map((size) => ({ size }));
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/splash/[size]">,
) {
  const { size } = await ctx.params;
  if (!SPLASH_SIZES.includes(size)) notFound();
  const [width, height] = size.split("x").map(Number);
  return splashImage(width, height);
}
