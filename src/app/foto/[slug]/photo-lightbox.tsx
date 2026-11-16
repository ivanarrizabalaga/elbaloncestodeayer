"use client";

import { useEffect, useRef } from "react";

type Props = { src: string; alt: string };

// «Ver la foto a tamaño completo»: the photo over the page, without leaving it.
// Opening adds a history entry, so the phone's «back» closes it instead of leaving the photo.
export function PhotoLightbox({ src, alt }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    function onPopState() {
      if (dialog.current?.open) dialog.current.close();
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function open() {
    dialog.current?.showModal();
    window.history.pushState({ lightbox: true }, "");
  }

  // Closed by the button, Esc or a tap outside the photo: drop our history entry too.
  // Closed by «back»: the entry is already gone.
  function onClose() {
    if (window.history.state?.lightbox) window.history.back();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Ver la foto a tamaño completo"
        className="absolute right-3 bottom-3 flex size-11 items-center justify-center rounded-full bg-bg/85"
      >
        <ExpandIcon />
      </button>
      <dialog
        ref={dialog}
        aria-label="Foto a tamaño completo"
        onClose={onClose}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        className="m-0 h-dvh max-h-none w-screen max-w-none items-center justify-center bg-bg p-0 text-fg backdrop:bg-bg open:flex"
      >
        {/* Same file as the page shows, so it is already loaded. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="max-h-full max-w-full object-contain"
        />
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          className="absolute top-3 right-3 inline-flex h-11 items-center gap-2 rounded-full bg-bg/85 px-4 text-sm font-medium"
        >
          <CloseIcon />
          Cerrar
        </button>
      </dialog>
    </>
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

function CloseIcon() {
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
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
