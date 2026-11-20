import type { DetailSuggestions } from "@/lib/photo-details";

type Values = {
  season_label?: string | null;
  team?: string | null;
  team_2?: string | null;
  venue?: string | null;
  competition?: string | null;
  provenance?: string | null;
  photographer?: string | null;
  story?: string | null;
};

// The descriptive fields of a photo (read back with readPhotoDetails). Used by admins in
// /admin/fotos/[id] and by whoever proposed the photo, at upload time and in /proponer/[id].
export function PhotoDetailsFields({
  values = {},
  suggestions,
}: {
  values?: Values;
  suggestions: DetailSuggestions;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Temporada o año"
          name="season_label"
          value={values.season_label}
          placeholder="1984–85"
        />
        <Field
          label="Competición"
          name="competition"
          value={values.competition}
          placeholder="Liga, torneo…"
          list={suggestions.competition}
        />
        <Field
          label="Equipo"
          name="team"
          value={values.team}
          list={suggestions.team}
        />
        <Field
          label="Segundo equipo (opcional)"
          name="team_2"
          value={values.team_2}
          list={suggestions.team}
        />
      </div>
      <Field
        label="Pabellón"
        name="venue"
        value={values.venue}
        list={suggestions.venue}
      />
      <Field
        label="Procedencia"
        name="provenance"
        value={values.provenance}
        placeholder="Colección de…, aportada por…"
        list={suggestions.provenance}
      />
      <Field
        label="Autor de la foto (si se sabe)"
        name="photographer"
        value={values.photographer}
      />
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        La historia
        <textarea
          name="story"
          rows={5}
          maxLength={4000}
          defaultValue={values.story ?? ""}
          placeholder="El partido, la temporada, alguna anécdota…"
          className="rounded-lg border border-line-strong bg-[#1a1a1a] px-3 py-2 text-base text-fg"
        />
      </label>
    </>
  );
}

export function Field({
  label,
  name,
  value,
  placeholder,
  type = "text",
  list,
}: {
  label: string;
  name: string;
  value?: string | null;
  placeholder?: string;
  type?: string;
  list?: string[];
}) {
  const listId = list?.length ? `${name}-options` : undefined;
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm text-muted">
      {label}
      <input
        type={type}
        name={name}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        list={listId}
        maxLength={type === "text" ? 200 : undefined}
        className="h-11 min-w-0 rounded-lg border border-line-strong bg-[#1a1a1a] px-3 text-base text-fg"
      />
      {listId && (
        <datalist id={listId}>
          {list!.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </label>
  );
}
