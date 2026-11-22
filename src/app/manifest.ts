import type { MetadataRoute } from "next";
import { ICON_BG } from "@/lib/app-icon";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

// Lets people add the site to their phone's home screen (SPEC §12). No service worker:
// no offline mode or push notifications.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Baloncesto",
    description: SITE_DESCRIPTION,
    lang: "es",
    start_url: "/",
    display: "standalone",
    background_color: ICON_BG,
    theme_color: ICON_BG,
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
      {
        src: "/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
