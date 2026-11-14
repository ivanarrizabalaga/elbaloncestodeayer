"use client";

import { useMemo, useState } from "react";
import { fold } from "@/lib/slug";

export type PersonOption = { id: string; name: string; detail: string };
export type PickedPerson = { id: string } | { newName: string } | null;

// «¿Quién es?»: search the archive first (accent-insensitive) to avoid duplicates; otherwise
// offer the typed name (admins create the person, users suggest it for review) or «?».
export function PersonPicker({
  people,
  onPick,
  onCancel,
  pending,
  newNameLabel,
  allowUnknown = true,
  intro = "¿Quién es? Busca primero en el archivo para no duplicar personas.",
}: {
  people: PersonOption[];
  onPick: (person: PickedPerson) => void;
  onCancel: () => void;
  pending: boolean;
  newNameLabel: (name: string) => string;
  allowUnknown?: boolean;
  intro?: string;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return [];
    return people.filter((p) => fold(p.name).includes(q)).slice(0, 8);
  }, [people, query]);
  const exactMatch = matches.some((p) => fold(p.name) === fold(query.trim()));

  return (
    <div
      role="dialog"
      aria-label="¿Quién es?"
      className="flex w-full flex-col gap-2 rounded-lg border border-line-strong bg-surface-2 p-3"
    >
      <label className="flex flex-col gap-1 text-sm text-muted">
        {intro}
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onCancel()}
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
                onClick={() => onPick({ id: person.id })}
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
            onClick={() => onPick({ newName: query.trim() })}
            className="inline-flex h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-on-accent"
          >
            {newNameLabel(query.trim())}
          </button>
        )}
        {allowUnknown && (
          <button
            type="button"
            disabled={pending}
            onClick={() => onPick(null)}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-dashed border-accent px-4 text-sm"
          >
            <span aria-hidden="true" className="font-bold text-accent">
              ?
            </span>
            No sé quién es
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 items-center rounded-full px-4 text-sm text-muted"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
