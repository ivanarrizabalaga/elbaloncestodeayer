import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

// Home, every published photo and every person who appears in one. Read through RLS, so
// only what a visitor can see is listed.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const supabase = await createClient();
  const [{ data: photos }, { data: tags }] = await Promise.all([
    supabase
      .from("photos")
      .select("slug, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false }),
    supabase
      .from("tags")
      .select("person:people!inner(slug, merged_into)")
      .not("person_id", "is", null)
      .is("removed_at", null),
  ]);

  const people = new Set(
    (tags ?? []).flatMap((t) =>
      t.person && !t.person.merged_into ? [t.person.slug] : [],
    ),
  );

  return [
    { url: `${origin}/`, changeFrequency: "daily", priority: 1 },
    ...(photos ?? []).map((p) => ({
      url: `${origin}/foto/${p.slug}`,
      lastModified: p.published_at ?? undefined,
      priority: 0.8,
    })),
    ...[...people].map((slug) => ({
      url: `${origin}/persona/${slug}`,
      priority: 0.6,
    })),
    { url: `${origin}/privacidad`, priority: 0.2 },
  ];
}
