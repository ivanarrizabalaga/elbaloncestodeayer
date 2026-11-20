import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { InviteButton } from "@/components/invite-button";
import { fold } from "@/lib/slug";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import { Chip, Table, Td } from "../table";

export const metadata: Metadata = { title: "Personas" };

// Where each person of the archive stands with their account.
type Status = "sin-invitar" | "pendiente" | "caducada" | "con-cuenta";

const TABS: { status: Status | null; label: string }[] = [
  { status: null, label: "Todas" },
  { status: "sin-invitar", label: "Sin invitar" },
  { status: "pendiente", label: "Invitación pendiente" },
  { status: "caducada", label: "Invitación caducada" },
  { status: "con-cuenta", label: "Con cuenta" },
];

const BUTTON =
  "inline-flex h-11 items-center rounded-full border border-line-strong px-4 text-[13px] font-medium";

export default async function PeoplePage({
  searchParams,
}: PageProps<"/admin/personas">) {
  await requireAdmin();
  const { estado, q } = await searchParams;
  const filter = TABS.find((t) => t.status === estado)?.status ?? null;
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

  const counts = new Map<Status | null, number>([[null, rows.length]]);
  for (const row of rows) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }
  const shown = rows.filter(
    (row) =>
      (!filter || row.status === filter) &&
      (!query || fold(row.full_name).includes(fold(query))),
  );

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

      <nav aria-label="Estado" className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = filter === tab.status;
          return (
            <Link
              key={tab.label}
              href={hrefFor(tab.status, query)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-medium ${
                active
                  ? "border-fg bg-fg text-bg"
                  : "border-line-strong text-fg"
              }`}
            >
              {tab.label}
              <span className="text-xs opacity-75">
                {counts.get(tab.status) ?? 0}
              </span>
            </Link>
          );
        })}
      </nav>

      <Form action="" className="flex max-w-md gap-2">
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

      {shown.length === 0 ? (
        <p className="text-muted">
          {query
            ? "Nadie coincide con esa búsqueda."
            : "No hay nadie en esta lista."}
        </p>
      ) : (
        <Table head={["Persona", "Fotos", "Estado", "Detalle", "Acciones"]}>
          {shown.map((row) => (
            <tr key={row.id} className="border-t border-line">
              <Td>
                <Link
                  href={`/admin/personas/${row.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {row.full_name}
                </Link>
              </Td>
              <Td>{row.photos}</Td>
              <Td>
                {row.status === "con-cuenta" ? (
                  <Chip>Con cuenta</Chip>
                ) : row.status === "pendiente" ? (
                  <Chip muted>Invitación pendiente</Chip>
                ) : row.status === "caducada" ? (
                  <Chip muted>Invitación caducada</Chip>
                ) : (
                  <span className="text-muted">Sin invitar</span>
                )}
              </Td>
              <Td>
                {row.account ? (
                  <Link
                    href={
                      row.account.role === "admin"
                        ? "/admin/usuarios"
                        : `/admin/usuarios?lista=usuarios&q=${encodeURIComponent(row.account.display_name ?? "")}`
                    }
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    Ver {row.account.role === "admin" ? "admin" : "usuario"}
                    {row.account.display_name &&
                      row.account.display_name !== row.full_name &&
                      ` (${row.account.display_name})`}
                  </Link>
                ) : row.invitation ? (
                  <span className="text-muted">
                    Por{" "}
                    {(row.invitation.invited_by &&
                      profileById.get(row.invitation.invited_by)
                        ?.display_name) ??
                      "alguien"}{" "}
                    {timeAgo(row.invitation.created_at)} ·{" "}
                    {row.status === "pendiente" ? "caduca " : "caducó "}
                    {timeAgo(row.invitation.expires_at)}
                  </span>
                ) : (
                  "—"
                )}
              </Td>
              <Td>
                {row.status !== "con-cuenta" && (
                  <InviteButton
                    personId={row.id}
                    personName={row.full_name}
                    tagId={row.tagId}
                    label={
                      row.status === "sin-invitar" ? "Invitar" : "Nuevo enlace"
                    }
                  />
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
      <p className="text-sm text-muted">
        Las invitaciones van por enlace, no por email: «Nuevo enlace» crea uno
        que dura 7 días para mandarlo por WhatsApp. Los enlaces anteriores
        siguen valiendo hasta que caducan.
      </p>
    </main>
  );
}

function hrefFor(status: Status | null, query: string): string {
  const params = new URLSearchParams();
  if (status) params.set("estado", status);
  if (query) params.set("q", query);
  return `?${params}`;
}
