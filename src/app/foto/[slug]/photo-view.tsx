"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

export type PhotoTag = {
  id: string;
  number: number;
  x: number;
  y: number;
  // null = unidentified «?» face
  person: { name: string; slug: string; claimed: boolean } | null;
};

type Props = {
  src: string;
  width: number;
  height: number;
  alt: string;
  tags: PhotoTag[];
  // Server-rendered pieces placed around the interactive parts.
  heading: ReactNode;
  details: ReactNode;
  actions: ReactNode;
  story: ReactNode;
};

// The photo with its numbered markers and the «En la foto» list share one selection.
// Mobile: photo, heading, people, story. Desktop: photo + story | heading + people.
export function PhotoView({
  src,
  width,
  height,
  alt,
  tags,
  heading,
  details,
  actions,
  story,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTags, setShowTags] = useState(true);

  const identified = tags.filter((tag) => tag.person).length;
  const unknown = tags.length - identified;

  function select(id: string) {
    setSelectedId(id);
    setShowTags(true);
  }

  return (
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-10">
      <figure className="m-0 flex flex-col gap-3 lg:col-start-1 lg:row-start-1">
        <div
          className="relative mx-auto overflow-hidden rounded-lg bg-surface-3"
          style={{
            aspectRatio: `${width} / ${height}`,
            // Fit tall photos in the viewport without distorting the markers.
            width: `min(100%, calc(80vh * ${width / height}))`,
          }}
        >
          {/* Plain <img>: derivatives are generated at upload time (phase 3), not by Next. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            width={width}
            height={height}
            alt={alt}
            className="absolute inset-0 h-full w-full"
          />

          {showTags &&
            tags.map((tag) => {
              const selected = tag.id === selectedId;
              const name = tag.person?.name ?? "¿Quién es?";
              return (
                <div
                  key={tag.id}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                  style={{ left: `${tag.x * 100}%`, top: `${tag.y * 100}%` }}
                >
                  <button
                    type="button"
                    onClick={() => select(tag.id)}
                    aria-label={`${tag.number}: ${tag.person?.name ?? "sin identificar"}`}
                    aria-pressed={selected}
                    className="flex size-11 items-center justify-center"
                  >
                    <span
                      className={`flex size-7.5 items-center justify-center rounded-full bg-bg/85 text-[13px] font-semibold ${
                        tag.person
                          ? "border-2 border-fg"
                          : "border-2 border-dashed border-accent text-sm font-bold text-accent"
                      } ${selected ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""}`}
                    >
                      {tag.person ? tag.number : "?"}
                    </span>
                  </button>
                  {selected && (
                    <span className="absolute top-11 rounded-md bg-accent px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap text-on-accent">
                      {name}
                    </span>
                  )}
                </div>
              );
            })}

          {tags.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTags(!showTags)}
              className="absolute top-3 right-3 inline-flex h-11 items-center gap-2 rounded-full bg-bg/85 px-4 text-sm font-medium"
            >
              <TagIcon />
              {showTags ? "Ocultar etiquetas" : "Mostrar etiquetas"}
            </button>
          )}
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            aria-label="Ver la foto a tamaño completo"
            className="absolute right-3 bottom-3 flex size-11 items-center justify-center rounded-full bg-bg/85"
          >
            <ExpandIcon />
          </a>
        </div>
        {tags.length > 0 && (
          <figcaption className="text-[13px] text-muted">
            Toca un número para ver quién es.
            {unknown > 0 &&
              ` ${unknown === 1 ? "Una cara sigue" : `${unknown} caras siguen`} sin nombre.`}
          </figcaption>
        )}
      </figure>

      <aside
        aria-label="Datos de la foto"
        className="flex flex-col gap-7 lg:col-start-2 lg:row-span-2 lg:row-start-1"
      >
        {heading}
        {details}

        <section aria-labelledby="en-la-foto" className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id="en-la-foto"
              className="font-display text-[26px] leading-none font-bold"
            >
              En la foto
            </h2>
            {tags.length > 0 && (
              <span className="text-[13px] text-muted">
                {identified} identificados
                {unknown > 0 && ` · ${unknown} por identificar`}
              </span>
            )}
          </div>

          {tags.length === 0 ? (
            <p className="text-sm text-muted">
              Todavía no hay nadie etiquetado en esta foto.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {tags.map((tag) => {
                const selected = tag.id === selectedId;
                return (
                  <li
                    key={tag.id}
                    className={`flex items-center gap-3 rounded-lg px-2.5 py-1 ${selected ? "bg-[#242424]" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => select(tag.id)}
                      aria-pressed={selected}
                      className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span
                        className={`flex size-7.5 flex-none items-center justify-center rounded-full border-2 text-[13px] font-bold ${
                          !tag.person || selected
                            ? "border-accent text-accent"
                            : "border-[#8a8a8a] text-[#8a8a8a]"
                        }`}
                      >
                        {tag.person ? tag.number : "?"}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="font-medium">
                          {tag.person?.name ?? "Sin identificar"}
                        </span>
                        <span className="text-xs text-muted">
                          {!tag.person
                            ? "¿Sabes quién es?"
                            : tag.person.claimed
                              ? "Perfil propio"
                              : "Todavía sin cuenta"}
                        </span>
                      </span>
                    </button>
                    {tag.person && (
                      <Link
                        href={`/persona/${tag.person.slug}`}
                        aria-label={`Ver a ${tag.person.name}`}
                        className="flex size-11 flex-none items-center justify-center rounded-full text-muted hover:text-fg"
                      >
                        <ChevronIcon />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {actions}
        </section>
      </aside>

      <div className="lg:col-start-1 lg:row-start-2">{story}</div>
    </div>
  );
}

function TagIcon() {
  return (
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
      <path d="M20 12l-8 8-9-9V3h8z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
