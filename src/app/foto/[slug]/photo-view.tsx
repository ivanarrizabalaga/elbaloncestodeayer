"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { InviteButton } from "@/components/invite-button";
import {
  PersonPicker,
  type PersonOption,
  type PickedPerson,
} from "@/components/person-picker";
import { PendingPoint, pointFrom } from "@/components/tag-point";
import {
  removeOwnTag,
  suggestName,
  tagFace,
  type ActionResult,
} from "./actions";
import { PhotoLightbox } from "./photo-lightbox";
import { PhotoStepper } from "./photo-stepper";
import { PhotoSwipe, type Neighbour } from "./photo-swipe";

export type PhotoTag = {
  id: string;
  number: number;
  x: number;
  y: number;
  // null = unidentified «?» face
  person: { id: string; name: string; slug: string; claimed: boolean } | null;
};

// Who is looking: null for visitors. personId = the person their account is linked to.
export type Viewer = { isAdmin: boolean; personId: string | null } | null;

type Props = {
  photoId: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  tags: PhotoTag[];
  // Neighbours in the gallery list (null at either end, or for unpublished photos).
  previous: Neighbour;
  next: Neighbour;
  viewer: Viewer;
  // For the «¿Quién es?» search (empty for visitors).
  people: PersonOption[];
  // Server-rendered pieces placed around the interactive parts.
  heading: ReactNode;
  details: ReactNode;
  actions: ReactNode;
  story: ReactNode;
};

// The photo with its numbered markers and the «En la foto» list share one selection.
// Mobile: photo, heading, people, story. Desktop: photo + story | heading + people.
export function PhotoView({
  photoId,
  src,
  width,
  height,
  alt,
  tags,
  previous,
  next,
  viewer,
  people,
  heading,
  details,
  actions,
  story,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTags, setShowTags] = useState(true);
  // «Etiquetar a alguien»: waiting for a click on a face, then the point picked.
  const [tagging, setTagging] = useState(false);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  // «Sé quién es» open on this tag.
  const [naming, setNaming] = useState<string | null>(null);
  // Feedback is shown next to where it happened: a tag row, or under the photo.
  const [notice, setNotice] = useState<{
    text: string;
    error: boolean;
    tagId?: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(
    action: () => Promise<ActionResult>,
    after: () => void,
    tagId?: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        after();
        setNotice(
          result.message ? { text: result.message, error: false, tagId } : null,
        );
        router.refresh();
      } else {
        setNotice({ text: result.error, error: true, tagId });
      }
    });
  }

  function stopTagging() {
    setTagging(false);
    setPoint(null);
  }

  function saveTag(person: PickedPerson) {
    if (!point) return;
    run(
      () => tagFace({ photoId, x: point.x, y: point.y, person }),
      stopTagging,
    );
  }

  const identified = tags.filter((tag) => tag.person).length;
  const unknown = tags.length - identified;

  function select(id: string) {
    setSelectedId(id);
    setShowTags(true);
  }

  return (
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-10">
      <figure className="m-0 flex flex-col gap-3 overflow-x-clip lg:col-start-1 lg:row-start-1">
        <div
          className="mx-auto flex flex-col gap-3"
          // Fit tall photos in the viewport without distorting the markers.
          // The previous/next strip below takes the same width.
          style={{ width: `min(100%, calc(80vh * ${width / height}))` }}
        >
          <PhotoSwipe
            key={src}
            previous={previous}
            next={next}
            enabled={!tagging}
          >
            <div
              className="relative overflow-hidden rounded-lg bg-surface-3"
              style={{ aspectRatio: `${width} / ${height}` }}
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

              {tagging && (
                <button
                  type="button"
                  aria-label="Toca la cara que quieres etiquetar"
                  onClick={(event) => setPoint(pointFrom(event))}
                  className="absolute inset-0 z-10 cursor-crosshair bg-bg/20"
                />
              )}
              {point && <PendingPoint point={point} />}

              {showTags &&
                tags.map((tag) => {
                  const selected = tag.id === selectedId;
                  const name = tag.person?.name ?? "¿Quién es?";
                  return (
                    <div
                      key={tag.id}
                      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                      style={{
                        left: `${tag.x * 100}%`,
                        top: `${tag.y * 100}%`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => select(tag.id)}
                        aria-label={`${tag.number}: ${tag.person?.name ?? "sin identificar"}`}
                        aria-pressed={selected}
                        className="flex size-11 items-center justify-center"
                      >
                        <span
                          className={`flex size-7.5 items-center justify-center rounded-full bg-bg/40 text-[13px] font-semibold ${
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
              <PhotoLightbox src={src} alt={alt} />
            </div>
          </PhotoSwipe>
          <PhotoStepper
            previousHref={previous?.href ?? null}
            nextHref={next?.href ?? null}
          />
        </div>
        {tagging &&
          (point ? (
            <PersonPicker
              people={people}
              pending={pending}
              onPick={saveTag}
              onCancel={stopTagging}
              newNameLabel={(name) =>
                viewer?.isAdmin
                  ? `Crear «${name}»`
                  : `No está: proponer «${name}»`
              }
            />
          ) : (
            <p
              role="status"
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm"
            >
              Toca la cara de la persona que quieres etiquetar.
              <button
                type="button"
                onClick={stopTagging}
                className="inline-flex min-h-11 items-center text-muted"
              >
                Cancelar
              </button>
            </p>
          ))}
        {notice && !notice.tagId && <Notice notice={notice} />}
        {tags.length > 0 && !tagging && (
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
                    className={`flex flex-wrap items-center gap-x-3 rounded-lg px-2.5 py-1 ${selected ? "bg-[#242424]" : ""}`}
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
                              ? "Tiene cuenta"
                              : "Aún no tiene cuenta"}
                        </span>
                      </span>
                    </button>
                    {viewer && !tag.person && naming !== tag.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setNaming(tag.id);
                          setNotice(null);
                        }}
                        className="inline-flex h-9 flex-none items-center rounded-full bg-accent px-3.5 text-[13px] font-semibold text-on-accent"
                      >
                        Sé quién es
                      </button>
                    )}
                    {viewer &&
                      tag.person &&
                      tag.person.id === viewer.personId && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => removeOwnTag(tag.id),
                              () => {},
                            )
                          }
                          className="inline-flex h-9 flex-none items-center rounded-full border border-line-strong px-3.5 text-[13px]"
                        >
                          Quitar mi etiqueta
                        </button>
                      )}
                    {viewer && tag.person && !tag.person.claimed && (
                      <InviteButton
                        personId={tag.person.id}
                        personName={tag.person.name}
                        tagId={tag.id}
                      />
                    )}
                    {tag.person && (
                      <Link
                        href={`/persona/${tag.person.slug}`}
                        aria-label={`Ver a ${tag.person.name}`}
                        className="flex size-11 flex-none items-center justify-center rounded-full text-muted hover:text-fg"
                      >
                        <ChevronIcon />
                      </Link>
                    )}
                    {naming === tag.id && (
                      <div className="mt-1 mb-2 w-full">
                        <PersonPicker
                          people={people}
                          pending={pending}
                          allowUnknown={false}
                          intro="¿Quién es? Si está en el archivo, elígelo; si no, escribe su nombre."
                          onPick={(person) =>
                            person &&
                            run(
                              () =>
                                suggestName({ tagId: tag.id, photoId, person }),
                              () => setNaming(null),
                              tag.id,
                            )
                          }
                          onCancel={() => setNaming(null)}
                          newNameLabel={(name) =>
                            viewer?.isAdmin
                              ? `Crear «${name}»`
                              : `Proponer «${name}»`
                          }
                        />
                      </div>
                    )}
                    {notice?.tagId === tag.id && (
                      <div className="mb-2 w-full">
                        <Notice notice={notice} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {viewer ? (
            !tagging && (
              <button
                type="button"
                onClick={() => {
                  setTagging(true);
                  setShowTags(true);
                  setNotice(null);
                }}
                className="mt-1.5 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent font-semibold text-on-accent"
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  +
                </span>
                Etiquetar a alguien
              </button>
            )
          ) : (
            <p className="text-sm text-muted">
              ¿Conoces a alguien de la foto?{" "}
              <Link href="/entrar" className="text-fg underline">
                Entra
              </Link>{" "}
              para etiquetarle o añadir un recuerdo.
            </p>
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

function Notice({ notice }: { notice: { text: string; error: boolean } }) {
  return (
    <p
      role={notice.error ? "alert" : "status"}
      className={`rounded-lg px-3 py-2 text-sm ${notice.error ? "border border-accent" : "bg-surface-2"}`}
    >
      {notice.text}
    </p>
  );
}
