import { appIcon } from "@/lib/app-icon";

// Served at /icon/32 (favicon), /icon/192 and /icon/512 (web app manifest).
export function generateImageMetadata() {
  return [32, 192, 512].map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id);
  return appIcon(size, size === 32 ? 46 : 36);
}
