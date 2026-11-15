import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { LookalikeList } from "@/components/lookalike-list";
import { PhotoGrid } from "@/components/photo-grid";
import { PhotoUploader } from "@/components/photo-uploader";
import { loadLookalikes, type Lookalike } from "@/lib/lookalikes";
import { photoLabel, photoSrc, seasonText } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import {
  discardDrafts,
  finishUpload,
  publishDrafts,
  publishFolder,
  startUpload,
} from "./actions";
import { SelectAll } from "./select-all";

export const metadata: Metadata = { title: "Subir fotos" };

const PAGE_SIZE = 50;
const FORM = "borradores-seleccion";

const DONE: Record<string, (n: number) => string> = {
  publicadas: (n) => (n === 1 ? "1 foto publicada." : `${n} fotos publicadas.`),
  descartadas: (n) =>
    n === 1 ? "1 borrador descartado." : `${n} borradores descartados.`,
};

type Draft = {
  id: string;
  slug: string;
  team: string | null;
  season_label: string | null;
  venue: string | null;
  competition: string | null;
  source_file: string | null;
  storage_key: string | null;
  width: number | null;
  height: number | null;
};

export default async function UploadPage({
  searchParams,
}: PageProps<"/admin/subir">) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";
  const table = one(params.vista) === "tabla";
  const folder = one(params.carpeta);
  const page = Math.max(1, Number.parseInt(one(params.pagina), 10) || 1);
  const ok = DONE[one(params.ok)]?.(Number(one(params.n)) || 0);

  // The admin layout already checked the role; RLS lets admins read drafts.
  const supabase = await createClient();
  let query = supabase
    .from("photos")
    .select(
      "id, slug, team, season_label, venue, competition, source_file, storage_key, width, height",
      { count: "exact" },
    )
    .eq("status", "draft");
  if (folder) {
    query = query.like("source_file", `${folder.replace(/[\\%_]/g, "\\$&")}/%`);
  }
  const [{ data, count }, { data: folders }] = await Promise.all([
    query
      .order("created_at", { ascending: false })
      .order("source_file")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from("draft_folders").select("folder, photos").order("folder"),
  ]);
  const drafts: Draft[] = data ?? [];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Keeps the current view, folder and page in every link and in the bulk actions.
  const href = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams();
    const merged = {
      vista: table ? "tabla" : null,
      carpeta: folder || null,
      pagina: page > 1 ? page : null,
      ...changes,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== null && value !== "") next.set(key, String(value));
    }
    const search = next.toString();
    return `/admin/subir${search ? `?${search}` : ""}`;
  };

  const lookalikes = table
    ? await loadLookalikes(
        supabase,
        drafts.map((d) => d.id),
      )
    : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-8 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[40px] leading-none font-bold">
          Subir fotos
        </h1>
        <p className="text-muted">
          Sube varias de golpe. Se quedan en borrador hasta que las publiques.
        </p>
      </div>

      <PhotoUploader
        start={startUpload}
        finish={finishUpload}
        doneLabel="Lista, en borradores"
      />

      <section aria-labelledby="borradores" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2
            id="borradores"
            className="font-display text-[30px] leading-none font-bold"
          >
            Borradores{total ? ` (${total})` : ""}
          </h2>
          <nav
            aria-label="Vista"
            className="flex rounded-full border border-line-strong p-0.5"
          >
            <ViewLink
              href={href({ vista: null })}
              active={!table}
              label="Cuadrícula"
            >
              <GridIcon />
            </ViewLink>
            <ViewLink
              href={href({ vista: "tabla" })}
              active={table}
              label="Tabla"
            >
              <TableIcon />
            </ViewLink>
          </nav>
        </div>

        {(folders?.length ?? 0) > 0 && (
          <nav aria-label="Carpeta" className="flex flex-wrap gap-2">
            <Chip href={href({ carpeta: null, pagina: null })} active={!folder}>
              Todas
            </Chip>
            {folders?.map((f) => (
              <Chip
                key={f.folder}
                href={href({ carpeta: f.folder, pagina: null })}
                active={f.folder === folder}
              >
                {f.folder}
                <span className="text-xs opacity-75">{f.photos}</span>
              </Chip>
            ))}
          </nav>
        )}

        {/* Only with a folder chosen: «all drafts» in one click is too easy to hit by mistake.
            In the table view it sits with the other actions. */}
        {folder && total > 0 && !table && (
          <form>
            <input type="hidden" name="back" value={href({})} />
            <input type="hidden" name="carpeta" value={folder} />
            <PublishFolderButton folder={folder} total={total} />
          </form>
        )}

        {ok && (
          <p
            role="status"
            className="rounded-lg border border-accent px-4 py-3"
          >
            {ok}
          </p>
        )}

        {drafts.length === 0 ? (
          <p className="text-muted">No hay borradores.</p>
        ) : table && lookalikes ? (
          <form id={FORM} className="flex flex-col gap-3">
            <input type="hidden" name="back" value={href({})} />
            <input type="hidden" name="carpeta" value={folder} />
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-bg py-2">
              <SelectAll form={FORM} />
              <div className="ml-auto flex flex-wrap gap-2">
                <ConfirmButton
                  label="Publicar"
                  title="¿Publicar las seleccionadas?"
                  body="Se publican tal como están, con sus datos actuales. Cada una tendrá su dirección pública."
                  confirmLabel="Publicar"
                  action={publishDrafts}
                  tone="neutral"
                  compact
                />
                {folder && total > 0 && (
                  <PublishFolderButton folder={folder} total={total} />
                )}
                <ConfirmButton
                  label="Descartar"
                  title="¿Descartar las seleccionadas?"
                  body="Dejan de aparecer en borradores y no se publican."
                  confirmLabel="Descartar"
                  action={discardDrafts}
                  compact
                />
              </div>
            </div>
            <DraftsTable drafts={drafts} lookalikes={lookalikes} />
          </form>
        ) : (
          <PhotoGrid
            photos={drafts.map((d) => ({
              ...d,
              href: `/admin/fotos/${d.id}`,
              caption:
                [d.season_label, d.team].filter(Boolean).join(" · ") ||
                "Sin datos",
            }))}
          />
        )}

        {pages > 1 && (
          <nav
            aria-label="Páginas"
            className="flex items-center justify-between gap-3 py-2"
          >
            {page > 1 ? (
              <PageLink href={href({ pagina: page - 1 > 1 ? page - 1 : null })}>
                ← Anteriores
              </PageLink>
            ) : (
              <span />
            )}
            <span className="text-sm text-muted">
              Página {page} de {pages}
            </span>
            {page < pages ? (
              <PageLink href={href({ pagina: page + 1 })}>
                Siguientes →
              </PageLink>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </main>
  );
}

function DraftsTable({
  drafts,
  lookalikes,
}: {
  drafts: Draft[];
  lookalikes: Map<string, Lookalike[]>;
}) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="sr-only">
        <tr>
          <th scope="col">Seleccionar</th>
          <th scope="col">Foto</th>
          <th scope="col">Datos</th>
        </tr>
      </thead>
      <tbody>
        {drafts.map((d) => {
          const similar = lookalikes.get(d.id) ?? [];
          const details = [
            d.season_label && seasonText(d.season_label),
            d.venue,
            d.competition,
          ].filter(Boolean);
          return (
            <tr key={d.id} className="border-b border-line align-top">
              <td className="w-11 py-2">
                <label className="flex size-11 cursor-pointer items-center justify-center">
                  <span className="sr-only">Seleccionar {photoLabel(d)}</span>
                  <input
                    type="checkbox"
                    name="id"
                    value={d.id}
                    className="size-4.5 accent-accent"
                  />
                </label>
              </td>
              <td className="w-28 py-2 pr-3 sm:w-36">
                <Link
                  href={`/admin/fotos/${d.id}`}
                  className="block aspect-[3/2] overflow-hidden rounded-md bg-surface-3"
                >
                  {d.storage_key && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoSrc(d.storage_key, "thumb")}
                      alt={`Foto: ${photoLabel(d)}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </Link>
              </td>
              <td className="py-2">
                <div className="flex flex-col gap-1">
                  <Link
                    href={`/admin/fotos/${d.id}`}
                    className={`font-semibold ${d.team ? "" : "text-muted"}`}
                  >
                    {d.team ?? "Sin equipo"}
                  </Link>
                  {details.length > 0 && (
                    <span className="text-muted">{details.join(" · ")}</span>
                  )}
                  {d.source_file && (
                    <span className="text-xs break-all text-muted">
                      {d.source_file}
                    </span>
                  )}
                  <LookalikeList items={similar} className="mt-1" />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// «Publicar las 46 de CAU»: every draft of the chosen folder, not only this page's.
function PublishFolderButton({
  folder,
  total,
}: {
  folder: string;
  total: number;
}) {
  return (
    <ConfirmButton
      label={
        total === 1
          ? `Publicar la de ${folder}`
          : `Publicar las ${total} de ${folder}`
      }
      title={
        total === 1
          ? `¿Publicar la foto de ${folder}?`
          : `¿Publicar las ${total} fotos de ${folder}?`
      }
      body="Se publican todos los borradores de esta carpeta, también los que no se ven en esta página, tal como están."
      confirmLabel={total === 1 ? "Publicar" : `Publicar ${total}`}
      action={publishFolder}
      tone="neutral"
      compact
    />
  );
}

// One side of the grid/table switch: an icon, named for screen readers and in a tooltip.
function ViewLink({
  href,
  active,
  label,
  children,
}: {
  href: string;
  active: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={label}
      className={`inline-flex size-11 items-center justify-center rounded-full ${
        active ? "bg-fg text-bg" : "text-muted hover:text-fg"
      }`}
    >
      {children}
      <span className="sr-only">{label}</span>
    </Link>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5 fill-current">
      <rect x="2" y="2" width="7" height="7" rx="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5 fill-current">
      <rect x="2" y="3" width="4" height="3" rx="1" />
      <rect x="8" y="3.5" width="10" height="2" rx="1" />
      <rect x="2" y="8.5" width="4" height="3" rx="1" />
      <rect x="8" y="9" width="10" height="2" rx="1" />
      <rect x="2" y="14" width="4" height="3" rx="1" />
      <rect x="8" y="14.5" width="10" height="2" rx="1" />
    </svg>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-medium ${
        active ? "border-fg bg-fg text-bg" : "border-line-strong text-fg"
      }`}
    >
      {children}
    </Link>
  );
}

function PageLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center rounded-full border border-line-strong px-5 text-sm font-medium"
    >
      {children}
    </Link>
  );
}
