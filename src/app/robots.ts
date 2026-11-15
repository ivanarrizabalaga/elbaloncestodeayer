import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

// Public pages are indexable; private areas and one-off links are not.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/auth/",
        "/cuenta",
        "/entrar",
        "/invitacion/",
        "/proponer",
        "/api/",
        "/foto/*/retirar",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
