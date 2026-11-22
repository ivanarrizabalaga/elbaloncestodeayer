import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { FaceCrop } from "@/components/face-crop";
import { pickPortrait } from "@/lib/people";
import { photoLabel, photoSrc } from "@/lib/photos";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { setPortrait } from "./actions";

export const metadata: Metadata = {
  title: "Elegir foto",
  robots: { index: false },
};

// The person themselves or an admin picks which face crop leads their page.
export default async function ChoosePortraitPage({
  params,
  searchParams,
}: PageProps<"/persona/[slug]/foto-destacada">) {
  const { slug } = await params;
  const { error } = await searchParams;
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: person } = await supabase
    .from("people")
    .select("id, full_name, slug, claimed_by, merged_into, portrait_tag_id")
    .eq("slug", slug)
    .maybeSingle();
  if (
    !person ||
    person.merged_into ||
    !user ||
    !(user.isAdmin || person.claimed_by === user.id)
  ) {
    notFound();
  }

  const { data: tags } = await supabase
    .from("tags")
    .select(
      "id, x, y, photo:photos!inner(slug, status, team, team_2, season_label, year_from, storage_key)",
    )
    .eq("person_id", person.id)
    .is("removed_at", null)
    .eq("photo.status", "published");
  const options = (tags ?? [])
    .filter((t) => t.photo.storage_key)
    .sort((a, b) => (b.photo.year_from ?? 0) - (a.photo.year_from ?? 0));
  const current = pickPortrait(options, person.portrait_tag_id);
  const isMe = person.claimed_by === user.id;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-6 sm:px-6">
      <BackLink
        fallback={`/persona/${person.slug}`}
        className="-ml-1 inline-flex min-h-11 w-fit items-center gap-1 pr-2 text-sm text-muted hover:text-fg"
      >
        ← Volver
      </BackLink>
      <div className="flex max-w-[640px] flex-col gap-1">
        <h1 className="font-display text-[40px] leading-none font-bold">
          {isMe ? "Elige tu foto" : `Elige la foto de ${person.full_name}`}
        </h1>
        <p className="text-muted">
          Es la que sale grande arriba de {isMe ? "tu página" : "su página"} y
          la que se ve al compartir el enlace por WhatsApp. Si no eliges
          ninguna, sale la de la temporada más reciente.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-accent px-4 py-3">
          No se pudo guardar. Recarga y vuelve a probar.
        </p>
      )}

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {options.map((tag) => {
          const chosen = tag.id === current?.id;
          return (
            <li key={tag.id}>
              <form action={setPortrait}>
                <input type="hidden" name="personId" value={person.id} />
                <input type="hidden" name="slug" value={person.slug} />
                <input type="hidden" name="tagId" value={tag.id} />
                <button
                  type="submit"
                  aria-pressed={chosen}
                  className={`flex w-full flex-col gap-2 rounded-lg p-1.5 text-left ${
                    chosen ? "ring-2 ring-accent" : "hover:bg-surface-2"
                  }`}
                >
                  <FaceCrop
                    src={photoSrc(tag.photo.storage_key!)}
                    x={tag.x}
                    y={tag.y}
                    alt=""
                    className="aspect-[4/5] w-full rounded-md"
                  />
                  <span className="text-sm">
                    {photoLabel(tag.photo)}
                    {chosen && (
                      <span className="block text-xs font-semibold text-accent">
                        La que sale ahora
                      </span>
                    )}
                  </span>
                </button>
              </form>
            </li>
          );
        })}
      </ul>

      {person.portrait_tag_id && (
        <form action={setPortrait}>
          <input type="hidden" name="personId" value={person.id} />
          <input type="hidden" name="slug" value={person.slug} />
          <input type="hidden" name="tagId" value="" />
          <button
            type="submit"
            className="inline-flex h-11 items-center rounded-full border border-line-strong px-4 text-[13px] font-medium"
          >
            Volver a la automática (la más reciente)
          </button>
        </form>
      )}
    </main>
  );
}
