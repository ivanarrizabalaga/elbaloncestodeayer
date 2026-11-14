import "server-only";
import { AwsClient } from "aws4fetch";

// Cloudflare R2 through its S3 API. Two buckets (SPEC §6):
// - originals: private, the files exactly as uploaded;
// - public: WebP derivatives, served at NEXT_PUBLIC_IMAGES_URL.
// Keys never leave the server.

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  }
  return value;
}

function client() {
  return new AwsClient({
    accessKeyId: env("R2_ACCESS_KEY_ID"),
    secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });
}

function objectUrl(bucket: string, key: string): URL {
  // EU buckets live at https://<account>.eu.r2.cloudflarestorage.com
  return new URL(`${env("R2_ENDPOINT")}/${bucket}/${key}`);
}

// A URL the browser can PUT one original to, valid for 10 minutes.
// The content type is part of the signature, so the browser must send the same one.
export async function presignOriginalUpload(
  key: string,
  contentType: string,
): Promise<string> {
  const url = objectUrl(env("R2_ORIGINALS_BUCKET"), key);
  url.searchParams.set("X-Amz-Expires", "600");
  const signed = await client().sign(
    new Request(url, {
      method: "PUT",
      headers: { "content-type": contentType },
    }),
    { aws: { signQuery: true } },
  );
  return signed.url;
}

export async function getOriginal(key: string): Promise<Buffer> {
  const response = await client().fetch(
    objectUrl(env("R2_ORIGINALS_BUCKET"), key),
  );
  if (!response.ok) {
    throw new Error(`Could not read original ${key}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function putPublic(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const response = await client().fetch(
    objectUrl(env("R2_PUBLIC_BUCKET"), key),
    {
      method: "PUT",
      body: new Uint8Array(body),
      headers: {
        "content-type": contentType,
        // Derivatives never change: a new upload gets a new key.
        "cache-control": "public, max-age=31536000, immutable",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Could not write ${key}: ${response.status}`);
  }
}
