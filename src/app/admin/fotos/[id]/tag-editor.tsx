"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type MouseEvent } from "react";
import {
  PersonPicker,
  type PersonOption,
  type PickedPerson,
} from "@/components/person-picker";
import { PendingPoint, pointFrom } from "@/components/tag-point";
import { addTag, removeTag } from "./actions";

export type EditorTag = {
  id: string;
  number: number;
  x: number;
  y: number;
  personName: string | null;
};

type Props = {
  photoId: string;
  src: string;
  width: number;
  height: number;
  tags: EditorTag[];
  people: PersonOption[];
};

// Admin tagging: click a face → pick someone from the archive, create a new person, or «?».
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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pick(event: MouseEvent<HTMLDivElement>) {
    setPoint(pointFrom(event));
    setError(null);
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setPoint(null);
        setError(null);
        router.refresh();
      } else {
        setError(result.error ?? "Algo ha fallado.");
      }
    });
  }

  function save(person: PickedPerson) {
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
          <Marker key={tag.id} tag={tag} />
        ))}
        {point && <PendingPoint point={point} />}
      </div>

      {point ? (
        <PersonPicker
          people={people}
          pending={pending}
          onPick={save}
          onCancel={() => setPoint(null)}
          newNameLabel={(name) => `Crear «${name}»`}
        />
      ) : (
        <p className="text-[13px] text-muted">
          Haz clic en una cara para etiquetarla.
        </p>
      )}
      {error && <p className="text-sm text-accent">{error}</p>}

      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="inline-flex h-9 items-center gap-1 rounded-full bg-surface-2 pr-1 pl-3 text-sm"
            >
              {tag.number} · {tag.personName ?? "Sin identificar"}
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

function Marker({ tag }: { tag: EditorTag }) {
  return (
    <span
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
  );
}
