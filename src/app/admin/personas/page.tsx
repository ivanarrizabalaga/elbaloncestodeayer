import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { InviteButton } from "@/components/invite-button";
import { fold } from "@/lib/slug";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import { Chip, Table, Td } from "../table";

export const metadata: Metadata = { title: "Personas" };

// Where each person of the archive stands with their account. An expired invitation
// counts as «sin invitar» in the filter: they need a new link all the same.
type Status = "sin-invitar" | "pendiente" | "caducada" | "con-cuenta";
type Filter = "sin-invitar" | "pendiente" | "con-cuenta";

const FILTERS: { value: Filter | null; label: string }[] = [
  { value: null, label: "Todas" },
  { value: "sin-invitar", label: "Sin invitar" },
  { value: "pendiente", label: "Invitación pendiente" },
  { value: "con-cuenta", label: "Con cuenta" },
];

const PAGE_SIZE = 50;

function filterOf(status: Status): Filter {
  return status === "caducada" ? "sin-invitar" : status;
}

const BUTTON =
  "inline-flex h-11 items-center rounded-full border border-line-strong px-4 text-[13px] font-medium";

export default async function PeoplePage({
  searchParams,
}: PageProps<"/admin/personas">) {
  await requireAdmin();
  const { estado, q, pagina } = await searchParams;
  const filter = FILTERS.find((f) => f.value === estado)?.value ?? null;
  const query = typeof q === "string" ? q.trim() : "";
  const supabase = await createClient();
  const now = new Date().getTime();

  const [{ data: peopleRows }, { data: invitationRows }] = await Promise.all([
    supabase
      .from("people")
      .select(
        "id, full_name, slug, claimed_by, tags(id, photo_id, photo:photos(status))",
      )
      .is("merged_into", null)
      .is("tags.removed_at", null)
      .order("full_name"),
    // Open person invitations, newest first: the first one per person is the one that counts.
    supabase
      .from("invitations")
      .select("person_id, created_at, expires_at, invited_by")
      .eq("role", "user")
      .not("person_id", "is", null)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  const people = peopleRows ?? [];

  const claimedIds = people.flatMap((p) =>
    p.claimed_by ? [p.claimed_by] : [],
  );
  const inviterIds = (invitationRows ?? []).flatMap((i) =>
    i.invited_by ? [i.invited_by] : [],
  );
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .in("id", [...new Set([...claimedIds, ...inviterIds])]);
  const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));

  const inviter = (id: string | null) =>
    (id && profileById.get(id)?.display_name) ?? "alguien";

  const lastInvitation = new Map<
    string,
    NonNullable<typeof invitationRows>[0]
  >();
  for (const invitation of invitationRows ?? []) {
    if (invitation.person_id && !lastInvitation.has(invitation.person_id)) {
      lastInvitation.set(invitation.person_id, invitation);
    }
  }

  const rows = people
    .map((person) => {
      const invitation = lastInvitation.get(person.id) ?? null;
      const status: Status = person.claimed_by
        ? "con-cuenta"
        : !invitation
          ? "sin-invitar"
          : new Date(invitation.expires_at).getTime() > now
            ? "pendiente"
            : "caducada";
      // The invitation page shows the photo of the tag it was sent from: pick a published one.
      const tag = person.tags.find((t) => t.photo?.status === "published");
      return {
        ...person,
        status,
        invitation,
        account: person.claimed_by
          ? (profileById.get(person.claimed_by) ?? null)
          : null,
        photos: new Set(person.tags.map((t) => t.photo_id)).size,
        tagId: tag?.id ?? null,
      };
    })
    // Most photographed first: they are the ones most worth inviting.
    .sort((a, b) => b.photos - a.photos);

  // Counts follow the search, so each pill says how many it would show.
  const searched = query
    ? rows.filter((row) => fold(row.full_name).includes(fold(query)))
    : rows;
  const counts = new Map<Filter | null, number>([[null, searched.length]]);
  for (const row of searched) {
    const key = filterOf(row.status);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const matching = filter
    ? searched.filter((row) => filterOf(row.status) === filter)
    : searched;
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const page = Math.min(
    pages,
    Math.max(1, Number.parseInt(String(pagina ?? "1"), 10) || 1),
  );
  const shown = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-8 sm:px-6">
      <div className="flex max-w-[640px] flex-col gap-1">
        <h1 className="font-display text-[40px] leading-none font-bold sm:text-[44px]">
          Personas
        </h1>
        <p className="text-muted">
          Todas las personas del archivo, tengan cuenta o no. Desde aquí puedes
          ver a quién falta invitar y sacar un enlace nuevo para mandárselo.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Form action="" className="flex w-full max-w-md gap-2">
          {filter && <input type="hidden" name="estado" value={filter} />}
          <input
            type="search"
            name="q"
            defaultValue={query}
            aria-label="Buscar personas"
            placeholder="Buscar por nombre"
            className="h-11 min-w-0 flex-1 rounded-lg border border-line-strong bg-[#1a1a1a] px-3 text-[15px] text-fg"
          />
          <button type="submit" className={BUTTON}>
            Buscar
          </button>
        </Form>
        <nav aria-label="Filtrar por cuenta" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <Link
                key={f.label}
                href={hrefFor({ filter: f.value, query })}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-medium ${
                  active
                    ? "border-fg bg-fg text-bg"
                    : "border-line-strong text-fg"
                }`}
              >
                {f.label}
                <span className="text-xs opacity-75">
                  {counts.get(f.value) ?? 0}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {shown.length === 0 ? (
        <p className="text-muted">
          {query
            ? "Nadie coincide con esa búsqueda."
            : "No hay nadie en esta lista."}
        </p>
      ) : (
        <Table head={["Persona", "Fotos", "Cuenta", "Acciones"]}>
          {shown.map((row) => (
            <tr key={row.id} className="border-t border-line">
              <Td>
                <Link
                  href={`/persona/${row.slug}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {row.full_name}
                </Link>
              </Td>
              <Td>{row.photos}</Td>
              <Td>
                <div className="flex flex-col items-start gap-1">
                  {row.status === "con-cuenta" ? (
                    <>
                      <Chip>Tiene cuenta</Chip>
                      {row.account && (
                        <Link
                          href={accountHref(row.account)}
                          className="text-xs text-accent underline-offset-4 hover:underline"
                        >
                          Ver su cuenta
                          {row.account.display_name &&
                            row.account.display_name !== row.full_name &&
                            ` (${row.account.display_name})`}
                        </Link>
                      )}
                    </>
                  ) : row.status === "pendiente" && row.invitation ? (
                    <>
                      <Chip muted>Invitada, aún no ha entrado</Chip>
                      <span className="text-xs text-muted">
                        Invitada por {inviter(row.invitation.invited_by)} ·
                        caduca {timeAgo(row.invitation.expires_at)}
                      </span>
                    </>
                  ) : row.status === "caducada" && row.invitation ? (
                    <>
                      <Chip muted>La invitación caducó</Chip>
                      <span className="text-xs text-muted">
                        Mándale un enlace nuevo
                      </span>
                    </>
                  ) : (
                    <Chip muted>Sin invitar</Chip>
                  )}
                </div>
              </Td>
              <Td>
                <div className="flex items-start justify-end gap-2">
                  {row.status !== "con-cuenta" && (
                    <InviteButton
                      personId={row.id}
                      personName={row.full_name}
                      tagId={row.tagId}
                      label={
                        row.status === "sin-invitar"
                          ? "Invitar"
                          : "Nuevo enlace"
                      }
                      className="h-11! border-line-strong! px-4!"
                    />
                  )}
                  <Link href={`/admin/personas/${row.id}`} className={BUTTON}>
                    Editar
                  </Link>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      {pages > 1 && (
        <nav
          aria-label="Páginas"
          className="flex items-center justify-between gap-3 text-sm"
        >
          {page > 1 ? (
            <Link
              href={hrefFor({ filter, query, page: page - 1 })}
              className={BUTTON}
            >
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, matching.length)} de {matching.length}
          </span>
          {page < pages ? (
            <Link
              href={hrefFor({ filter, query, page: page + 1 })}
              className={BUTTON}
            >
              Siguiente →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
      <p className="text-sm text-muted">
        Las invitaciones van por enlace, no por email: «Nuevo enlace» crea uno
        que dura 7 días para mandarlo por WhatsApp. Los enlaces anteriores
        siguen valiendo hasta que caducan.
      </p>
    </main>
  );
}

function hrefFor({
  filter,
  query,
  page = 1,
}: {
  filter: Filter | null;
  query: string;
  page?: number;
}): string {
  const params = new URLSearchParams();
  if (filter) params.set("estado", filter);
  if (query) params.set("q", query);
  if (page > 1) params.set("pagina", String(page));
  return `?${params}`;
}

// Admins are listed in the first tab of /admin/usuarios; users are searched by name.
function accountHref(account: {
  role: string;
  display_name: string | null;
}): string {
  return account.role === "admin"
    ? "/admin/usuarios"
    : `/admin/usuarios?lista=usuarios&q=${encodeURIComponent(account.display_name ?? "")}`;
}
