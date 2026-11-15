"use client";

import { useRef } from "react";

// A destructive button that asks first, in a native <dialog> (focus trap, Esc to close).
// It must sit inside a <form>: the confirm button submits that form to `action`.
export function ConfirmButton({
  label,
  title,
  body,
  confirmLabel,
  action,
}: {
  label: string;
  title: string;
  body: string;
  confirmLabel: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex h-12 items-center rounded-full border border-danger px-6 font-semibold text-danger"
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="confirm-title"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line-strong bg-surface p-6 text-fg backdrop:bg-black/70"
      >
        <h2
          id="confirm-title"
          className="font-display text-[26px] leading-none font-bold"
        >
          {title}
        </h2>
        <p className="mt-3 text-sm text-muted">{body}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            autoFocus
            onClick={() => dialog.current?.close()}
            className="inline-flex h-11 items-center rounded-full border border-line-strong px-5 font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            formAction={action}
            className="inline-flex h-11 items-center rounded-full bg-danger px-5 font-semibold text-bg"
          >
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
