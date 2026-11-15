"use client";

import { useRef, useState, useTransition } from "react";
import { inviteAdmin, type InviteResult } from "./actions";

// «Invitar administrador»: a dialog with the email; shows the link afterwards in case the
// email does not arrive (it can also go by WhatsApp).
export function InviteAdmin() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function open() {
    setEmail("");
    setResult(null);
    setCopied(false);
    dialog.current?.showModal();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex h-11 items-center rounded-full bg-accent px-5 font-semibold text-on-accent"
      >
        Invitar administrador
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="invite-admin-title"
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl border border-line-strong bg-surface p-6 text-fg backdrop:bg-black/70"
      >
        <h2
          id="invite-admin-title"
          className="font-display text-[26px] leading-none font-bold"
        >
          Invitar a un administrador
        </h2>

        {result?.ok ? (
          <div className="mt-4 flex flex-col gap-3 text-sm">
            <p role="status">
              {result.emailed
                ? `Le hemos mandado un enlace a ${email.trim()}.`
                : "La invitación está creada, pero el email no se pudo enviar."}{" "}
              También puedes pasarle el enlace tú:
            </p>
            <input
              readOnly
              value={result.url}
              aria-label="Enlace de la invitación"
              onFocus={(e) => e.target.select()}
              className="h-11 rounded-lg border border-line-strong bg-[#1a1a1a] px-3 text-fg"
            />
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(result.url);
                  setCopied(true);
                }}
                className="inline-flex h-11 items-center rounded-full border border-line-strong px-5 font-medium"
              >
                {copied ? "Copiado" : "Copiar enlace"}
              </button>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                className="inline-flex h-11 items-center rounded-full bg-accent px-5 font-semibold text-on-accent"
              >
                Hecho
              </button>
            </div>
          </div>
        ) : (
          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => setResult(await inviteAdmin(email)));
            }}
          >
            <label className="flex flex-col gap-2 text-sm text-muted">
              Email
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@correo.com"
                className="h-11 rounded-lg border border-line-strong bg-[#1a1a1a] px-3 text-[15px] text-fg"
              />
            </label>
            <div className="flex flex-col gap-1 rounded-lg bg-surface-2 px-4 py-3 text-sm">
              <strong>Como admin podrá:</strong>
              <span className="text-muted">
                Subir, editar y publicar fotos · Revisar lo pendiente ·
                Gestionar usuarios · Invitar o quitar a otros admins
              </span>
            </div>
            <p className="text-sm text-muted">
              Le llega un enlace para entrar, igual que a cualquier usuario. Si
              ya tiene cuenta, al aceptarlo pasa a ser admin. Si no lo acepta en
              7 días, la invitación caduca.
            </p>
            {result && !result.ok && (
              <p role="alert" className="text-sm text-accent">
                {result.error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                className="inline-flex h-11 items-center rounded-full border border-line-strong px-5 font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-11 items-center rounded-full bg-accent px-5 font-semibold text-on-accent disabled:opacity-60"
              >
                {pending ? "Enviando…" : "Enviar invitación"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
