"use client";

import { useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { PersonPicker, type PersonOption } from "@/components/person-picker";

// «Fusionar con otra persona»: search the person that stays, then confirm.
export function MergePicker({
  personId,
  personName,
  people,
  action,
}: {
  personId: string;
  personName: string;
  people: PersonOption[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<PersonOption | null>(null);

  if (target) {
    return (
      <form className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="id" value={personId} />
        <input type="hidden" name="target" value={target.id} />
        <span className="text-sm">
          Se queda <strong>{target.name}</strong>{" "}
          <span className="text-muted">({target.detail})</span>
        </span>
        <ConfirmButton
          compact
          label="Fusionar"
          title={`¿Fusionar ${personName} con ${target.name}?`}
          body={`Sus etiquetas, invitaciones y cuenta (si la tiene) pasan a ${target.name}, y su página lleva a la de ${target.name}. No se puede deshacer desde aquí.`}
          confirmLabel="Sí, fusionar"
          action={action}
        />
        <button
          type="button"
          onClick={() => setTarget(null)}
          className="inline-flex h-11 items-center rounded-full px-4 text-sm text-muted"
        >
          Cambiar
        </button>
      </form>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-fit items-center rounded-full border border-line-strong px-4 text-[13px] font-medium"
      >
        Fusionar con otra persona
      </button>
    );
  }

  return (
    <PersonPicker
      people={people}
      pending={false}
      allowNew={false}
      allowUnknown={false}
      newNameLabel={() => ""}
      intro={`¿Con quién está duplicada? Busca la persona que se queda.`}
      onCancel={() => setOpen(false)}
      onPick={(picked) => {
        if (picked && "id" in picked) {
          setTarget(people.find((p) => p.id === picked.id) ?? null);
        }
      }}
    />
  );
}
