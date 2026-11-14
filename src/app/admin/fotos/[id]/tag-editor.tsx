"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type MouseEvent } from "react";
import { fold } from "@/lib/slug";
import { addTag, removeTag } from "./actions";

export type EditorTag = {
  id: string;
  number: number;
  x: number;
  y: number;
  personName: string | null;
};

export type PersonOption = { id: string; name: string; detail: string };

type Props = {
  photoId: string;
  src: string;
  width: number;
  height: number;
  tags: EditorTag[];
  people: PersonOption[];
};

// Click a face → «¿Quién es?»: pick someone from the archive, create a new person,
// or leave it as «?» for others to identify. Searching first avoids duplicates.
export function TagEditor({
  photoId,
  src,
  width,
  height,
  tags,
  people,
}: Props) {
  const router = useRouter();
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return [];
    return people.filter((p) => fold(p.name).includes(q)).slice(0, 8);
  }, [people, query]);
  const exactMatch = matches.some((p) => fold(p.name) === fold(query.trim()));

  function pick(event: MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    setPoint({
      x: round((event.clientX - box.left) / box.width),
      y: round((event.clientY - box.top) / box.height),
    });
    setQuery("");
    setError(null);
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setPoint(null);
        setQuery("");
        setError(null);
        router.refresh();
      } else {
        setError(result.error ?? "Algo ha fallado.");
      }
    });
  }

  function save(person: { id: string } | { newName: string } | null) {
    if (!point) return;
    run(() => addTag({ photoId, x: point.x, y: point.y, person }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative mx-auto cursor-crosshair overflow-hidden rounded-lg bg-surface-3"
        style={{
          aspectRatio: `${width} / ${height}`,
          width: `min(100%, calc(75vh * ${width / height}))`,
        }}
        onClick={pick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Foto que se está etiquetando"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none"
        />
        {tags.map((tag) => (
          <span
            key={tag.id}
            aria-hidden="true"
            className={`absolute flex size-7.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-bg/85 text-[13px] font-semibold ${
              tag.personName
                ? "border-2 border-fg"
                : "border-2 border-dashed border-accent text-accent"
            }`}
            style={{ left: `${tag.x * 100}%`, top: `${tag.y * 100}%` }}
          >
            {tag.personName ? tag.number : "?"}
          </span>
        ))}
        {point && (
          <span
            aria-hidden="true"
            className="absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-accent/30"
            style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
          />
        )}
      </div>

      {point ? (
        <div
          role="dialog"
          aria-label="¿Quién es?"
          className="flex flex-col gap-2 rounded-lg border border-line-strong bg-surface-2 p-3"
        >
          <label className="flex flex-col gap-1 text-sm text-muted">
            ¿Quién es? Busca primero en el archivo para no duplicar personas.
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setPoint(null)}
              placeholder="Nombre y apellidos"
              className="h-11 rounded-lg border border-line-strong bg-[#1a1a1a] px-3 text-base text-fg"
            />
          </label>
          {matches.length > 0 && (
            <ul className="flex flex-col">
              {matches.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => save({ id: person.id })}
                    className="flex min-h-11 w-full flex-col justify-center rounded-md px-2 text-left hover:bg-surface-3"
                  >
                    <span className="font-medium">{person.name}</span>
                    <span className="text-xs text-muted">{person.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            {query.trim() && !exactMatch && (
              <button
                type="button"
                disabled={pending}
                onClick={() => save({ newName: query })}
                className="inline-flex h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-on-accent"
              >
                Crear «{query.trim()}»
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => save(null)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-dashed border-accent px-4 text-sm"
            >
              <span aria-hidden="true" className="font-bold text-accent">
                ?
              </span>
              No sé quién es
            </button>
            <button
              type="button"
              onClick={() => setPoint(null)}
              className="inline-flex h-11 items-center rounded-full px-4 text-sm text-muted"
            >
              Cancelar
            </button>
          </div>
          {error && <p className="text-sm text-accent">{error}</p>}
        </div>
      ) : (
        <p className="text-[13px] text-muted">
          Haz clic en una cara para etiquetarla.
        </p>
      )}

      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="inline-flex h-9 items-center gap-1 rounded-full bg-surface-2 pr-1 pl-3 text-sm"
            >
              {tag.personName
                ? `${tag.number} · ${tag.personName}`
                : `${tag.number} · Sin identificar`}
              <button
                type="button"
                disabled={pending}
                aria-label={`Quitar etiqueta ${tag.number}`}
                onClick={() => run(() => removeTag(tag.id))}
                className="flex size-9 items-center justify-center rounded-full text-muted hover:text-fg"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function round(n: number): number {
  return Math.min(1, Math.max(0, Math.round(n * 10000) / 10000));
}
