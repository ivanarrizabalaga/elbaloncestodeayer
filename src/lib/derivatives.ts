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

// Perceptual hash (dHash, 64 bits as 16 hex chars): compares each pixel of a 9×8 grayscale
// thumbnail with its right neighbour. Copies of the same image (resized, re-encoded, a
// screenshot) give hashes that differ in only a few bits; see hashDistance.
export async function imageHash(image: Buffer): Promise<string> {
  const pixels = await sharp(image, { limitInputPixels: 200_000_000 })
    .rotate()
    .grayscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer();
  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0;
    for (let j = i; j < i + 4; j++) {
      const y = Math.floor(j / 8);
      const x = j % 8;
      nibble =
        (nibble << 1) | (pixels[y * 9 + x] > pixels[y * 9 + x + 1] ? 1 : 0);
    }
    hex += nibble.toString(16);
  }
  return hex;
}

// Number of differing bits between two imageHash values (0 = same picture; ≤ 12 = probably).
export function hashDistance(a: string, b: string): number {
  let count = 0;
  for (let i = 0; i < 16; i++) {
    let diff = Number.parseInt(a[i], 16) ^ Number.parseInt(b[i], 16);
    while (diff) {
      count += diff & 1;
      diff >>= 1;
    }
  }
  return count;
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
