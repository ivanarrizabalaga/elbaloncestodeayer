"use client";

import { useId, useRef } from "react";

// A destructive button that asks first, in a native <dialog> (focus trap, Esc to close).
// It must sit inside a <form>: the confirm button submits that form to `action`.
export function ConfirmButton({
  label,
  title,
  body,
  confirmLabel,
  action,
  tone = "danger",
  compact = false,
}: {
  label: string;
  title: string;
  body: string;
  confirmLabel: string;
  action: (formData: FormData) => Promise<void>;
  // "neutral" for consequential but not destructive actions (e.g. «Hacer admin»).
  tone?: "danger" | "neutral";
  // Smaller trigger, for table rows.
  compact?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const size = compact ? "h-11 px-4 text-[13px]" : "h-12 px-6";
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={`inline-flex items-center rounded-full border font-semibold ${size} ${
          tone === "danger"
            ? "border-danger text-danger"
            : "border-line-strong text-fg"
        }`}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl text-left whitespace-normal border border-line-strong bg-surface p-6 text-fg backdrop:bg-black/70"
      >
        <h2
          id={titleId}
          className="font-display text-[26px] leading-none font-bold"
        >
          {title}
        </h2>
        <p className="mt-3 text-sm whitespace-normal text-muted">{body}</p>
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
            className={`inline-flex h-11 items-center rounded-full px-5 font-semibold ${
              tone === "danger"
                ? "bg-danger text-bg"
                : "bg-accent text-on-accent"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
