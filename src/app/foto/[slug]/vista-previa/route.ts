import sharp from "sharp";
import { photoSrc } from "@/lib/photos";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

// Link preview (Open Graph) for a photo: 1200×630 JPEG. WhatsApp and others handle JPEG far
// more reliably than WebP, so the large derivative is converted here. Only published photos
// (RLS), and long cache headers: the image of a slug never changes in practice.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/foto/[slug]/vista-previa">,
) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("photos")
    .select("storage_key")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!photo?.storage_key) return new Response("Not found", { status: 404 });

  const src = photoSrc(photo.storage_key, "large");
  const source = await fetch(
    src.startsWith("/") ? `${await siteOrigin()}${src}` : src,
  );
  if (!source.ok) return new Response("Not found", { status: 404 });

  const jpeg = await sharp(Buffer.from(await source.arrayBuffer()))
    .resize(1200, 630, { fit: "cover", position: "attention" })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  return new Response(new Uint8Array(jpeg), {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "public, max-age=86400, s-maxage=604800",
    },
  });
}
