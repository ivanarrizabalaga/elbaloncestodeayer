"use client";

import { useState, useTransition } from "react";
import { createInvitation } from "@/app/invitacion/actions";

// «Invitar»: creates an invitation and offers the link to send by WhatsApp or copy.
export function InviteButton({
  personId,
  personName,
  tagId = null,
  className = "",
  label = "Invitar",
}: {
  personId: string;
  personName: string;
  tagId?: string | null;
  className?: string;
  label?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function invite() {
    startTransition(async () => {
      const result = await createInvitation({ personId, tagId });
      if (result.ok) setUrl(result.url);
      else setError(result.error);
    });
  }

  if (!url) {
    return (
      <span className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={invite}
          disabled={pending}
          className={`inline-flex h-9 flex-none items-center rounded-full border border-[#5a5a5a] px-3.5 text-[13px] font-medium ${className}`}
        >
          {pending ? "Creando…" : label}
        </button>
        {error && <span className="text-xs text-accent">{error}</span>}
      </span>
    );
  }

  const firstName = personName.split(" ")[0];
  const text = `¡Hola, ${firstName}! Sales en una foto de El baloncesto de ayer. ¿Eres tú? ${url}`;
  return (
    <span
      role="status"
      className="flex w-full flex-col gap-2 rounded-lg bg-surface-3 p-3 text-sm"
    >
      <span>
        Enlace para {personName} listo. Caduca en 7 días y sirve una sola vez.
      </span>
      <span className="flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          className="inline-flex h-10 items-center rounded-full bg-accent px-4 font-semibold text-on-accent"
        >
          Mandar por WhatsApp
        </a>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
          className="inline-flex h-10 items-center rounded-full border border-line-strong px-4"
        >
          {copied ? "Copiado" : "Copiar enlace"}
        </button>
      </span>
    </span>
  );
}
