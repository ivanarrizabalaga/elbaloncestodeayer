"use client";

import Form from "next/form";

// Same shape as GalleryFilters in src/lib/gallery.ts (server-only, so not imported here).
export type Filters = {
  decade: number | null;
  team: string;
  venue: string;
  competition: string;
  unnamed: boolean;
};

// A value and how many photos it gives with the other filters applied.
type Option<T> = { value: T; count: number };

type Props = {
  filters: Filters;
  decades: Option<number>[];
  teams: Option<string>[];
  venues: Option<string>[];
};

// A GET form: filters live in the URL (shareable, works without JavaScript).
// With JavaScript, any change submits it right away (client-side navigation, no reload).
export function GalleryFilters({ filters, decades, teams, venues }: Props) {
  return (
    <Form
      action="/"
      scroll={false}
      onChange={(event) => event.currentTarget.requestSubmit()}
      className="flex flex-wrap items-center gap-3"
    >
      {/* No control of its own (it arrives from a photo page): kept when others change. */}
      {filters.competition && (
        <input type="hidden" name="competicion" value={filters.competition} />
      )}
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Década</legend>
        <DecadePill value="" label="Todas" checked={filters.decade === null} />
        {decades.map(({ value: decade }) => (
          <DecadePill
            key={decade}
            value={String(decade)}
            label={`Años ${String(decade).slice(-2)}`}
            checked={filters.decade === decade}
          />
        ))}
      </fieldset>

      <span
        aria-hidden="true"
        className="hidden h-7 w-px bg-[#2e2e2e] sm:block"
      />

      <Select
        name="equipo"
        label="Equipo"
        value={filters.team}
        options={teams}
      />
      <Select
        name="pabellon"
        label="Pabellón"
        value={filters.venue}
        options={venues}
      />

      <label className="inline-flex min-h-11 items-center gap-2 text-sm sm:ml-auto">
        <input
          type="checkbox"
          name="sin-nombre"
          value="1"
          defaultChecked={filters.unnamed}
          className="size-4.5 accent-accent"
        />
        Solo fotos con caras sin nombre
      </label>

      {/* Without JavaScript the form needs a button; with it, changes apply on their own. */}
      <noscript>
        <button
          type="submit"
          className="h-10 rounded-full border border-line-strong px-4 text-sm font-medium"
        >
          Aplicar
        </button>
      </noscript>
    </Form>
  );
}

function DecadePill({
  value,
  label,
  checked,
}: {
  value: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name="decada"
        value={value}
        defaultChecked={checked}
        className="peer sr-only"
      />
      <span className="inline-flex h-10 items-center rounded-full border border-line-strong px-4 text-sm peer-checked:border-fg peer-checked:bg-fg peer-checked:font-semibold peer-checked:text-bg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
        {label}
      </span>
    </label>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: Option<string>[];
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="h-10 max-w-48 rounded-lg border border-line-strong bg-[#1a1a1a] px-3 text-sm text-fg"
      >
        <option value="">Todos</option>
        {options.map(({ value, count }) => (
          <option key={value} value={value}>
            {value} ({count})
          </option>
        ))}
      </select>
    </label>
  );
}
