"use client";

import { useEffect, useState } from "react";

// Instagram has no "share this link" URL like wa.me, and a link shared to it can only go
// in a direct message. An image file, though, offers Story, Post and Message. So the
// button shares the photo itself (the generic «Compartir» button shares the link).
//
// The file is prepared on load: Safari drops the share sheet if the tap and the share
// call are separated by a download. Derivatives are WebP, which Instagram does not
// always accept, so it is re-encoded as JPEG. Where files cannot be shared (most
// desktops, older browsers, or the image could not be read), it falls back to sharing
// or copying the link.
export function InstagramShare({
  imageSrc,
  fileName,
  text,
  url,
  className = "",
}: {
  imageSrc: string;
  fileName: string;
  text: string;
  url: string;
  className?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!navigator.canShare) return;
    let cancelled = false;
    toJpegFile(imageSrc, fileName)
      .then((jpeg) => {
        if (!cancelled && navigator.canShare({ files: [jpeg] })) setFile(jpeg);
      })
      .catch(() => {
        // Could not read the image: keep the link fallback.
      });
    return () => {
      cancelled = true;
    };
  }, [imageSrc, fileName]);

  async function share() {
    if (file || navigator.share) {
      try {
        await navigator.share(file ? { files: [file] } : { text, url });
      } catch {
        // Cancelled by the user: nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard blocked: nothing else we can do.
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={share}
        className={`inline-flex h-12 items-center justify-center gap-2 rounded-full bg-linear-to-r from-instagram-1 via-instagram-2 to-instagram-3 px-5.5 font-semibold text-white ${className}`}
      >
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
        </svg>
        Compartir en Instagram
      </button>
      <p role="status" className="text-[13px] text-muted">
        {copied && "Enlace copiado. Pégalo en Instagram."}
      </p>
    </div>
  );
}

async function toJpegFile(src: string, name: string): Promise<File> {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  bitmap.close();
  const jpeg = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!jpeg) throw new Error("Could not encode the image as JPEG");
  return new File([jpeg], `${name}.jpg`, { type: "image/jpeg" });
}
