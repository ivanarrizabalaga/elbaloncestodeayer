import type { Metadata } from "next";

export const SITE_NAME = "El baloncesto de ayer";
export const SITE_DESCRIPTION =
  "Archivo fotográfico colaborativo del baloncesto de antes. Reconócete, etiqueta a tus compañeros e invítales.";

type OpenGraph = NonNullable<Metadata["openGraph"]>;

// A page's openGraph replaces the layout's instead of merging with it, so every page builds
// its own from these defaults.
export function openGraph(fields: OpenGraph): OpenGraph {
  return { siteName: SITE_NAME, locale: "es_ES", type: "website", ...fields };
}

// A 1200×630 JPEG preview of a published photo (see /foto/[slug]/vista-previa).
export function previewImage(slug: string, alt: string) {
  return { url: `/foto/${slug}/vista-previa`, width: 1200, height: 630, alt };
}
