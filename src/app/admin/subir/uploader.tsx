"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { finishUpload, startUpload } from "./actions";

type Item = {
  key: string;
  name: string;
  status: "pending" | "uploading" | "processing" | "done" | "error";
  error?: string;
};

const STATUS_LABEL: Record<Item["status"], string> = {
  pending: "En cola",
  uploading: "Subiendo…",
  processing: "Procesando…",
  done: "Lista, en borradores",
  error: "Error",
};

// Uploads one file at a time: sign → PUT straight to R2 → process on the server.
export function Uploader() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const busy = items.some(
    (i) => i.status === "uploading" || i.status === "processing",
  );

  function update(key: string, patch: Partial<Item>) {
    setItems((all) => all.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  async function uploadAll(files: File[]) {
    const queued = files.map((file) => ({
      file,
      item: {
        key: crypto.randomUUID(),
        name: file.name,
        status: "pending" as const,
      },
    }));
    setItems((all) => [...queued.map((q) => q.item), ...all]);

    for (const { file, item } of queued) {
      try {
        update(item.key, { status: "uploading" });
        const started = await startUpload({ type: file.type, size: file.size });
        if (!started.ok) {
          update(item.key, { status: "error", error: started.error });
          continue;
        }

        const put = await fetch(started.uploadUrl, {
          method: "PUT",
          headers: { "content-type": file.type },
          body: file,
        });
        if (!put.ok) {
          update(item.key, {
            status: "error",
            error: "No se pudo subir el archivo.",
          });
          continue;
        }

        update(item.key, { status: "processing" });
        const finished = await finishUpload(started.id);
        update(
          item.key,
          finished.ok
            ? { status: "done" }
            : { status: "error", error: finished.error },
        );
      } catch {
        update(item.key, {
          status: "error",
          error: "Error de conexión. Inténtalo de nuevo.",
        });
      }
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const files = [...event.dataTransfer.files].filter((f) =>
            f.type.startsWith("image/"),
          );
          if (files.length > 0 && !busy) uploadAll(files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
          dragging ? "border-accent bg-surface-2" : "border-line-strong"
        }`}
      >
        <span>
          <strong>Arrastra aquí las fotos</strong> o elige archivos
        </span>
        <span className="text-sm text-muted">
          JPG, PNG, WebP o TIFF, hasta 50 MB. Mejor escaneadas a buena
          resolución.
        </span>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/tiff"
          disabled={busy}
          className="sr-only"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            if (files.length > 0) uploadAll(files);
          }}
        />
      </label>

      {items.length > 0 && (
        <ul aria-live="polite" className="flex flex-col gap-1 text-sm">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex flex-wrap justify-between gap-x-4 rounded-md bg-surface-2 px-3 py-2"
            >
              <span className="min-w-0 truncate">{item.name}</span>
              <span
                className={
                  item.status === "error"
                    ? "text-accent"
                    : item.status === "done"
                      ? "text-fg"
                      : "text-muted"
                }
              >
                {item.error ?? STATUS_LABEL[item.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
