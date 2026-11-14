import sharp from "sharp";

// WebP derivatives served publicly (SPEC §6): large ~1600 px (longest side), thumb ~480 px wide.
// rotate() applies the EXIF orientation; limitInputPixels guards against huge files.
// Plain module: used by the upload Server Action and by local import scripts.
export async function makeDerivatives(original: Buffer) {
  const image = sharp(original, { limitInputPixels: 200_000_000 }).rotate();
  const large = await image
    .clone()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await image
    .clone()
    .resize({ width: 480, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  return {
    large: large.data,
    thumb,
    width: large.info.width,
    height: large.info.height,
  };
}

// photos/<id> -> its objects in the two buckets.
export function photoKeys(id: string) {
  const storageKey = `photos/${id}`;
  return {
    storageKey,
    original: `${storageKey}/original`,
    large: `${storageKey}/large.webp`,
    thumb: `${storageKey}/thumb.webp`,
  };
}
