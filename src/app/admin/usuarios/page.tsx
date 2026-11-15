import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { initials } from "@/lib/site";
import { fold } from "@/lib/slug";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import {
  blockUser,
  cancelInvitation,
  makeAdmin,
  removeAdmin,
  resendInvitation,
  unblockUser,
} from "./actions";
import { InviteAdmin } from "./invite-admin";

export const metadata: Metadata = { title: "Usuarios y administradores" };

const ERRORS: Record<string, string> = {
  ultimo: "Tiene que quedar al menos un admin activo.",
  envio: "No se pudo enviar el email. Prueba otra vez en un minuto.",
  "1": "No se pudo completar la acción.",
};

const BUTTON =
  "inline-flex h-11 items-center rounded-full border border-line-strong px-4 text-[13px] font-medium";

export default async function UsersPage({
  searchParams,
}: PageProps<"/admin/usuarios">) {
  const me = await requireAdmin();
  const { lista, q, error, ok } = await searchParams;
  const showUsers = lista === "usuarios";
  const query = typeof q === "string" ? q.trim() : "";
  const supabase = await createClient();

  const [{ data: accounts }, { data: invitations }] = await Promise.all([
    supabase.rpc("admin_user_list"),
    supabase
      .from("invitations")
      .select("id, email, created_at, invited_by")
      .eq("role", "admin")
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);
  const all = accounts ?? [];
  const pending = invitations ?? [];
  const admins = all.filter((a) => a.role === "admin" && !a.blocked_at);
  const users = all.filter((a) => !(a.role === "admin" && !a.blocked_at));
  const nameById = new Map(all.map((a) => [a.id, a.display_name]));
  const shown = query
    ? users.filter((u) =>
        fold(`${u.display_name ?? ""} ${u.email ?? ""}`).includes(fold(query)),
      )
    : users;
  const problem = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[640px] flex-col gap-1">
          <h1 className="font-display text-[40px] leading-none font-bold sm:text-[44px]">
            Usuarios y administradores
          </h1>
          <p className="text-muted">
            Hay dos roles. Los usuarios etiquetan, añaden recuerdos, invitan y
            proponen fotos. Los admins, además, publican, revisan lo pendiente y
            gestionan los usuarios.
          </p>
        </div>
        <InviteAdmin />
      </div>

      {(problem || ok === "reenviada") && (
        <p
          role={problem ? "alert" : "status"}
          className={`rounded-lg px-4 py-3 ${problem ? "border border-accent" : "bg-surface-2"}`}
        >
          {problem ?? "Invitación reenviada, con un enlace nuevo."}
        </p>
      )}

      <nav aria-label="Lista" className="flex gap-1 border-b border-line">
        <Tab href="?" active={!showUsers}>
          Administradores · {admins.length}
        </Tab>
        <Tab href="?lista=usuarios" active={showUsers}>
          Usuarios · {users.length}
        </Tab>
      </nav>

      {!showUsers ? (
        <>
          <Table
            head={[
              "Persona",
              "Estado",
              "Último acceso",
              "Revisiones",
              "Acciones",
            ]}
          >
            {admins.map((a) => (
              <tr key={a.id} className="border-t border-line">
                <Td>
                  <Who name={a.display_name} email={a.email} />
                </Td>
                <Td>
                  <Chip>Admin</Chip>
                </Td>
                <Td>
                  {a.last_sign_in_at ? timeAgo(a.last_sign_in_at) : "Nunca"}
                </Td>
                <Td>
                  {a.open_reviews_count > 0
                    ? `${a.open_reviews_count} en curso`
                    : "—"}
                </Td>
                <Td>
                  {a.id === me.id ? (
                    <span className="text-muted">Tú</span>
                  ) : (
                    <form>
                      <input type="hidden" name="id" value={a.id} />
                      <ConfirmButton
                        compact
                        label="Quitar admin"
                        title={`¿Quitar de admin a ${a.display_name ?? a.email}?`}
                        body="Seguirá siendo usuario: podrá etiquetar, añadir recuerdos y proponer fotos, pero no publicar ni revisar."
                        confirmLabel="Sí, quitar admin"
                        action={removeAdmin}
                      />
                    </form>
                  )}
                </Td>
              </tr>
            ))}
            {pending.map((invitation) => (
              <tr key={invitation.id} className="border-t border-line">
                <Td>
                  <div className="flex flex-col">
                    <span className="font-medium">{invitation.email}</span>
                    <span className="text-xs text-muted">
                      Invitado por{" "}
                      {(invitation.invited_by &&
                        nameById.get(invitation.invited_by)) ??
                        "un admin"}{" "}
                      {timeAgo(invitation.created_at)}
                    </span>
                  </div>
                </Td>
                <Td>
                  <Chip muted>Invitación pendiente</Chip>
                </Td>
                <Td>—</Td>
                <Td>—</Td>
                <Td>
                  <form className="flex items-center gap-2 whitespace-nowrap">
                    <input type="hidden" name="id" value={invitation.id} />
                    <button
                      type="submit"
                      formAction={resendInvitation}
                      className={BUTTON}
                    >
                      Reenviar
                    </button>
                    <button
                      type="submit"
                      formAction={cancelInvitation}
                      className={BUTTON}
                    >
                      Cancelar
                    </button>
                  </form>
                </Td>
              </tr>
            ))}
          </Table>
          <p className="text-sm text-muted">
            Todos los admins pueden lo mismo, también invitar o quitar a otros
            admins. Siempre tiene que quedar al menos uno, así que nadie puede
            quitarse a sí mismo si es el último.
          </p>
        </>
      ) : (
        <>
          <Form action="" className="flex max-w-md gap-2">
            <input type="hidden" name="lista" value="usuarios" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              aria-label="Buscar usuarios"
              placeholder="Buscar por nombre o email"
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
                : "Todavía no hay usuarios."}
            </p>
          ) : (
            <Table
              head={[
                "Usuario",
                "Perfil en el archivo",
                "Invitado por",
                "Aportaciones",
                "Acciones",
              ]}
            >
              {shown.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <Td>
                    <Who name={u.display_name} email={u.email} />
                  </Td>
                  <Td>
                    {u.person_slug ? (
                      <Link
                        href={`/persona/${u.person_slug}`}
                        className="text-accent underline-offset-4 hover:underline"
                      >
                        {u.person_name}
                      </Link>
                    ) : (
                      <span className="text-muted">No sale en las fotos</span>
                    )}
                  </Td>
                  <Td>{u.invited_by_name ?? "—"}</Td>
                  <Td>{contributions(u)}</Td>
                  <Td>
                    <form className="flex items-center gap-2 whitespace-nowrap">
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="lista" value="usuarios" />
                      {u.blocked_at ? (
                        <>
                          <Chip danger>Bloqueado</Chip>
                          <button
                            type="submit"
                            formAction={unblockUser}
                            className={BUTTON}
                          >
                            Desbloquear
                          </button>
                        </>
                      ) : (
                        <>
                          <ConfirmButton
                            compact
                            tone="neutral"
                            label="Hacer admin"
                            title={`¿Hacer admin a ${u.display_name ?? u.email}?`}
                            body="Podrá subir, editar y publicar fotos, revisar lo pendiente y gestionar usuarios, también a otros admins."
                            confirmLabel="Sí, hacer admin"
                            action={makeAdmin}
                          />
                          <ConfirmButton
                            compact
                            label="Bloquear"
                            title={`¿Bloquear a ${u.display_name ?? u.email}?`}
                            body="No podrá etiquetar, añadir recuerdos, invitar ni proponer fotos. Lo que ya aportó se queda. Puedes desbloquearlo cuando quieras."
                            confirmLabel="Sí, bloquear"
                            action={blockUser}
                          />
                        </>
                      )}
                    </form>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
          <p className="text-sm text-muted">
            «Invitado por» deja ver por dónde ha ido creciendo el archivo.
            Bloquear impide etiquetar y proponer, pero no borra lo que ya
            aportó.
          </p>
        </>
      )}
    </main>
  );
}

function Tab({
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
      className={`-mb-px flex min-h-11 items-center border-b-2 px-3 text-sm font-medium ${
        active
          ? "border-accent text-fg"
          : "border-transparent text-muted hover:text-fg"
      }`}
    >
      {children}
    </Link>
  );
}

// Wide tables scroll sideways on phones instead of squashing.
function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg bg-surface">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="text-xs text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className="px-4 py-3 font-medium">
                {i === head.length - 1 ? (
                  <span className="sr-only">{h}</span>
                ) : (
                  h
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 align-middle">{children}</td>;
}

function Who({ name, email }: { name: string | null; email: string | null }) {
  const label = name ?? email ?? "Sin nombre";
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-9 flex-none items-center justify-center rounded-full bg-[#2e2e2e] text-[13px] font-semibold"
      >
        {initials(label)}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="font-medium">{name ?? "Sin nombre"}</span>
        <span className="text-xs text-muted">{email}</span>
      </div>
    </div>
  );
}

function Chip({
  children,
  muted = false,
  danger = false,
}: {
  children: ReactNode;
  muted?: boolean;
  danger?: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${
        danger
          ? "border border-danger text-danger"
          : muted
            ? "border border-line-strong text-muted"
            : "bg-surface-3 text-accent"
      }`}
    >
      {children}
    </span>
  );
}

function contributions(u: {
  tags_count: number;
  memories_count: number;
  suggestions_count: number;
  photos_count: number;
}): string {
  const parts = [
    [u.tags_count, "etiqueta", "etiquetas"],
    [u.memories_count, "recuerdo", "recuerdos"],
    [u.suggestions_count, "nombre sugerido", "nombres sugeridos"],
    [u.photos_count, "foto propuesta", "fotos propuestas"],
  ] as const;
  const text = parts
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
    .join(" · ");
  return text || "Nada todavía";
}
