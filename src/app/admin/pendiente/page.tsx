import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { FaceCrop } from "@/components/face-crop";
import { photoLabel, photoSrc } from "@/lib/photos";
import { payloadText, reviewGroupKey } from "@/lib/review";
import { initials } from "@/lib/site";
import { fold } from "@/lib/slug";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import {
  acceptSuggestion,
  clearDisputedTag,
  dismissItems,
  publishProposal,
  rejectProposal,
  resolveItems,
  takeItems,
  undoActivity,
  withdrawPhoto,
} from "./actions";

export const metadata: Metadata = { title: "Pendiente de revisar" };

const TABS = [
  { id: "", label: "Todo", kinds: null },
  { id: "fotos", label: "Fotos propuestas", kinds: ["photo_proposal"] },
  { id: "nombres", label: "Nombres sugeridos", kinds: ["name_suggestion"] },
  { id: "retiradas", label: "Retiradas", kinds: ["removal_request"] },
  {
    id: "otros",
    label: "Etiquetas y duplicados",
    kinds: ["tag_dispute", "duplicate_person"],
  },
] as const;

const PHOTO = "slug, team, season_label, storage_key";
// What a proposer may have filled in, shown on the proposal card.
const DETAILS =
  "venue, competition, provenance, photographer, story, source_file";

export default async function PendingPage({
  searchParams,
}: PageProps<"/admin/pendiente">) {
  const admin = await requireAdmin();
  const { tipo, error } = await searchParams;
  const tab = TABS.find((t) => t.id === tipo) ?? TABS[0];
  const supabase = await createClient();

  const [itemsResult, activityResult, peopleResult] = await Promise.all([
    supabase
      .from("review_items")
      .select(
        `id, kind, priority, payload, tag_id, person_id, photo_id, created_by, assigned_to, created_at,
         person:people(full_name),
         photo:photos(id, ${PHOTO}, ${DETAILS}),
         tag:tags(x, y, label_number, removed_at, current:people(full_name), photo:photos(${PHOTO}))`,
      )
      .eq("status", "open")
      .order("created_at"),
    supabase
      .from("activity")
      .select("id, action, actor_id, target_id, data, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("people").select("full_name").is("merged_into", null),
  ]);
  const rows = itemsResult.data ?? [];
  const activity = activityResult.data ?? [];
  const knownNames = new Set(
    (peopleResult.data ?? []).map((p) => fold(p.full_name)),
  );

  // Identical suggestions are one decision (see reviewGroupKey).
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = reviewGroupKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const all = [...groups.values()]
    .map((group) => ({
      rows: group,
      first: group[0],
      priority: group.some((r) => r.priority),
      latest: group[group.length - 1].created_at,
      assignedTo: group.find((r) => r.assigned_to)?.assigned_to ?? null,
    }))
    .sort((a, b) => Number(b.priority) - Number(a.priority));
  const visible = tab.kinds
    ? all.filter((g) => (tab.kinds as readonly string[]).includes(g.first.kind))
    : all;

  const names = await profileNames(supabase, [
    ...rows.flatMap((r) => [r.created_by, r.assigned_to]),
    ...activity.map((a) => a.actor_id),
    ...activity.map((a) => (a.action in ACCOUNT_ACTIONS ? a.target_id : null)),
  ]);
  const nameOf = (id: string | null) =>
    id === admin.id ? "Tú" : ((id && names.get(id)) ?? "Alguien");
  const targets = await activityTargets(supabase, activity);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[40px] leading-none font-bold sm:text-[44px]">
            Pendiente de revisar
          </h1>
          <p className="text-muted">
            Lo que proponen los usuarios y necesita el visto bueno de un admin.
            Quedaos cada uno con lo vuestro para no pisaros.
          </p>
        </div>
        <dl className="flex gap-6 text-sm">
          <Count value={all.length} label="pendientes" />
          <Count
            value={all.filter((g) => !g.assignedTo).length}
            label="sin asignar"
          />
          <Count
            value={all.filter((g) => g.priority).length}
            label="prioritarias"
            accent
          />
        </dl>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-accent px-4 py-3">
          No se pudo completar la acción. Puede que otro admin ya la hubiera
          resuelto; recarga y vuelve a probar.
        </p>
      )}

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section aria-label="Cola de revisión" className="flex flex-col gap-4">
          <nav aria-label="Tipo" className="flex flex-wrap gap-2">
            {TABS.map((t) => {
              const count = t.kinds
                ? all.filter((g) =>
                    (t.kinds as readonly string[]).includes(g.first.kind),
                  ).length
                : all.length;
              const active = t.id === tab.id;
              return (
                <Link
                  key={t.id}
                  href={t.id ? `?tipo=${t.id}` : "?"}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-medium ${
                    active
                      ? "border-fg bg-fg text-bg"
                      : "border-line-strong text-fg"
                  }`}
                >
                  {t.label}
                  <span className="text-xs opacity-75">{count}</span>
                </Link>
              );
            })}
          </nav>

          {visible.length === 0 ? (
            <p className="rounded-lg bg-surface px-4 py-6 text-muted">
              No hay nada pendiente aquí. 🏀
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {visible.map((group) => (
                <li key={group.first.id}>
                  <ReviewCard
                    group={group}
                    who={whoList(
                      group.rows.map((r) =>
                        r.created_by
                          ? nameOf(r.created_by)
                          : (payloadText(r.payload, "name") ?? "Alguien"),
                      ),
                    )}
                    assignee={
                      group.assignedTo ? nameOf(group.assignedTo) : null
                    }
                    knownNames={knownNames}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside
          aria-labelledby="actividad"
          className="flex flex-col gap-3.5 rounded-lg bg-surface p-5"
        >
          <h2
            id="actividad"
            className="font-display text-[26px] leading-none font-bold"
          >
            Actividad reciente
          </h2>
          <p className="text-[13px] text-muted">
            Etiquetas y recuerdos que se publican sin revisión. Si algo está
            mal, se deshace aquí.
          </p>
          {activity.length === 0 ? (
            <p className="text-sm text-muted">Todavía no hay actividad.</p>
          ) : (
            <ul className="flex flex-col">
              {activity.map((entry) => (
                <ActivityRow
                  key={entry.id}
                  entry={entry}
                  actor={nameOf(entry.actor_id)}
                  subject={nameOf(entry.target_id)}
                  targets={targets}
                />
              ))}
            </ul>
          )}
        </aside>
      </div>
    </main>
  );
}

function Count({
  value,
  label,
  accent = false,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="order-2 text-muted">{label}</dt>
      <dd
        className={`font-display text-[22px] font-bold ${accent && value > 0 ? "text-accent" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue items
// ---------------------------------------------------------------------------

type Client = Awaited<ReturnType<typeof createClient>>;
type PhotoRef = {
  slug: string;
  team: string | null;
  season_label: string | null;
  storage_key: string | null;
};
type Row = {
  id: string;
  kind: string;
  payload: unknown;
  created_by: string | null;
  person: { full_name: string } | null;
  photo:
    | (PhotoRef & {
        id: string;
        venue: string | null;
        competition: string | null;
        provenance: string | null;
        photographer: string | null;
        story: string | null;
        source_file: string | null;
      })
    | null;
  tag: {
    x: number;
    y: number;
    label_number: number;
    removed_at: string | null;
    current: { full_name: string } | null;
    photo: PhotoRef | null;
  } | null;
};
type Group = {
  rows: Row[];
  first: Row;
  priority: boolean;
  latest: string;
};
type Action = (formData: FormData) => Promise<void>;
// Destructive actions ask first: [title, body, confirm label].
type Confirm = [string, string, string];

function ReviewCard({
  group,
  who,
  assignee,
  knownNames,
}: {
  group: Group;
  who: { names: string; plural: boolean };
  assignee: string | null;
  knownNames: Set<string>;
}) {
  const { first: item, rows } = group;
  const photo = item.tag?.photo ?? item.photo;
  const where = photo ? photoLabel(photo) : "Foto sin datos";
  const card = describe(
    item,
    rows.length,
    who.names,
    who.plural,
    where,
    knownNames,
  );

  return (
    <article
      className={`flex gap-4 rounded-lg bg-surface p-4 ring-1 ring-inset ${group.priority ? "ring-accent" : "ring-line"}`}
    >
      <Thumb item={item} photo={photo} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-surface-3 px-2 py-0.5 font-semibold text-[#c8c8c8]">
            {card.type}
          </span>
          {group.priority && (
            <span className="rounded-full bg-accent px-2 py-0.5 font-bold text-on-accent">
              Prioritaria
            </span>
          )}
          <span className="text-muted">{timeAgo(group.latest)}</span>
        </div>
        <h2 className="text-base leading-snug font-semibold">{card.title}</h2>
        <p className="text-sm text-muted">
          {card.detail}
          {photo && (
            <>
              {" "}
              <Link
                href={`/foto/${photo.slug}`}
                className="text-accent underline-offset-4 hover:underline"
              >
                Ver foto
              </Link>
            </>
          )}
        </p>
        {card.extra}
        <form className="mt-1.5 flex flex-wrap items-center gap-2">
          <input
            type="hidden"
            name="ids"
            value={rows.map((r) => r.id).join(",")}
          />
          {card.actions.map(([label, action, confirm], i) => (
            <Fragment key={label}>
              {confirm ? (
                <ConfirmButton
                  compact
                  label={label}
                  title={confirm[0]}
                  body={confirm[1]}
                  confirmLabel={confirm[2]}
                  action={action}
                />
              ) : (
                <button
                  type="submit"
                  formAction={action}
                  className={`inline-flex h-11 items-center rounded-full px-4 text-[13px] ${
                    i === 0
                      ? "bg-accent font-semibold text-on-accent"
                      : "border border-line-strong font-medium"
                  }`}
                >
                  {label}
                </button>
              )}
              {/* A link right after the main action (e.g. «Revisar»). */}
              {i === 0 && card.link}
            </Fragment>
          ))}
          <span className="flex-1" />
          {assignee ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-[#c8c8c8]">
              <span
                aria-hidden="true"
                className="flex size-6 items-center justify-center rounded-full bg-[#2e2e2e] text-[10px] font-bold"
              >
                {initials(assignee)}
              </span>
              {assignee}
            </span>
          ) : (
            <button
              type="submit"
              formAction={takeItems}
              className="inline-flex h-11 items-center rounded-full border border-dashed border-[#5a5a5a] px-3 text-[13px] text-[#c8c8c8]"
            >
              Me lo quedo
            </button>
          )}
        </form>
      </div>
    </article>
  );
}

function describe(
  item: Row,
  count: number,
  who: string,
  plural: boolean,
  where: string,
  knownNames: Set<string>,
): {
  type: string;
  title: string;
  detail: string;
  actions: [string, Action, Confirm?][];
  link?: ReactNode;
  extra?: ReactNode;
} {
  switch (item.kind) {
    case "name_suggestion": {
      const name = item.person?.full_name ?? payloadText(item.payload, "name");
      const tag = item.tag;
      const face = !tag
        ? "una cara"
        : tag.current
          ? `el nº ${tag.label_number} (ahora «${tag.current.full_name}»)`
          : `el ?${tag.label_number}`;
      const says = plural ? "dicen" : "dice";
      const times = count > 1 ? ` Lo han sugerido ${count} veces.` : "";
      if (!tag || tag.removed_at) {
        return {
          type: "Nombre sugerido",
          title: `${who} ${says} que ${face} es «${name}»`,
          detail: `${where}. La etiqueta ya se quitó de la foto.`,
          actions: [["Descartar", dismissItems]],
        };
      }
      const exists =
        item.person !== null || (name !== null && knownNames.has(fold(name)));
      return {
        type: "Nombre sugerido",
        title: `${who} ${says} que ${face} es «${name}»`,
        detail: `${where}. ${
          exists
            ? "Esa persona ya existe en el archivo."
            : "No hay nadie con ese nombre en el archivo: al aceptar se crea la persona."
        }${times}`,
        actions: [
          [exists ? "Aceptar" : "Aceptar y crear persona", acceptSuggestion],
          ["Descartar", dismissItems],
        ],
      };
    }
    case "tag_dispute": {
      const suggested = payloadText(item.payload, "suggested_name");
      return {
        type: "Etiqueta discutida",
        title: `«No soy yo» en una etiqueta de ${item.person?.full_name ?? "alguien"}`,
        detail: `${where}. Quien abrió la invitación dice que no es esa persona${
          suggested ? ` y propone «${suggested}»` : ""
        }. Si quitas el nombre, la cara vuelve a «?» y la invitación deja de valer.`,
        actions: [
          ["Quitar el nombre", clearDisputedTag],
          ["Mantener", dismissItems],
        ],
      };
    }
    case "removal_request": {
      const reason = payloadText(item.payload, "reason");
      const contact = payloadText(item.payload, "contact");
      return {
        type: "Petición de retirada",
        title: `${who} ${plural ? "piden" : "pide"} retirar una foto`,
        detail: `${where}. Motivo: ${reason?.replace(/[.\s]+$/, "") ?? "no lo dice"}. ${
          contact ? `Contacto: ${contact}.` : "No ha dejado contacto."
        }`,
        actions: [
          ["Retirar foto", withdrawPhoto],
          ["Descartar", dismissItems],
        ],
      };
    }
    case "photo_proposal": {
      const comment = payloadText(item.payload, "comment");
      return {
        type: "Foto propuesta",
        title: `${who} ${plural ? "han" : "ha"} propuesto una foto`,
        detail: comment ? `Comentario: «${comment}».` : "Sin comentario.",
        extra: item.photo && <ProposalDetails photo={item.photo} />,
        // «Publicar» as it is; «Revisar» to change details or tag faces first.
        actions: [
          ["Publicar", publishProposal],
          [
            "Rechazar",
            rejectProposal,
            [
              "¿Rechazar esta foto?",
              "Se borran los archivos y no se publica. Quien la propuso la verá como «No publicada» en sus fotos. No se puede deshacer.",
              "Sí, rechazar",
            ],
          ],
        ],
        link: item.photo && (
          <Link
            href={`/admin/fotos/${item.photo.id}`}
            className="inline-flex h-11 items-center rounded-full border border-line-strong px-4 text-[13px] font-medium"
          >
            Revisar
          </Link>
        ),
      };
    }
    default:
      return {
        type: "Posible duplicado",
        title: `${item.person?.full_name ?? "Una persona"} podría estar duplicada`,
        detail: payloadText(item.payload, "reason") ?? "",
        actions: [
          ["Hecho", resolveItems],
          ["Descartar", dismissItems],
        ],
      };
  }
}

// The details the proposer gave, so the admin can publish without leaving the queue.
function ProposalDetails({ photo }: { photo: NonNullable<Row["photo"]> }) {
  const rows = (
    [
      ["Temporada", photo.season_label],
      ["Equipo", photo.team],
      ["Pabellón", photo.venue],
      ["Competición", photo.competition],
      ["Procedencia", photo.provenance],
      ["Autor", photo.photographer],
    ] as const
  ).filter(([, value]) => value);
  if (rows.length === 0 && !photo.story) {
    return (
      <p className="text-sm text-muted">
        Sin datos{photo.source_file ? ` (archivo «${photo.source_file}»)` : ""}:
        revísala para completarlos antes de publicar.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1 text-sm">
      {rows.length > 0 && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
          {rows.map(([label, value]) => (
            <Fragment key={label}>
              <dt className="text-muted">{label}</dt>
              <dd className="break-words">{value}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      {photo.story && (
        <details>
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-accent">
            Leer la historia
          </summary>
          <p className="whitespace-pre-line text-muted">{photo.story}</p>
        </details>
      )}
    </div>
  );
}

function Thumb({ item, photo }: { item: Row; photo: PhotoRef | null }) {
  const box = "h-[66px] w-[88px] flex-none rounded-md";
  if (photo?.storage_key && item.tag) {
    return (
      <FaceCrop
        src={photoSrc(photo.storage_key, "thumb")}
        x={item.tag.x}
        y={item.tag.y}
        alt=""
        className={box}
      />
    );
  }
  if (photo?.storage_key) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoSrc(photo.storage_key, "thumb")}
        alt=""
        className={`${box} object-cover`}
      />
    );
  }
  return <span aria-hidden="true" className={`${box} bg-surface-3`} />;
}

// «Carlos», «Carlos y Pepe», «Carlos y 2 más»
function whoList(all: string[]): { names: string; plural: boolean } {
  const unique = [...new Set(all)];
  const plural = unique.length > 1;
  if (unique.length <= 1) return { names: unique[0] ?? "Alguien", plural };
  if (unique.length === 2) {
    return { names: `${unique[0]} y ${unique[1]}`, plural };
  }
  return { names: `${unique[0]} y ${unique.length - 1} más`, plural };
}

async function profileNames(
  supabase: Client,
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", unique);
  return new Map(
    (data ?? []).flatMap((p) =>
      p.display_name ? [[p.id, p.display_name] as const] : [],
    ),
  );
}

// ---------------------------------------------------------------------------
// Recent activity
// ---------------------------------------------------------------------------

type Entry = {
  id: string;
  action: string;
  actor_id: string | null;
  target_id: string | null;
  data: unknown;
  created_at: string;
};

async function activityTargets(supabase: Client, activity: Entry[]) {
  const idsFor = (actions: string[]) => [
    ...new Set(
      activity.flatMap((a) =>
        actions.includes(a.action) && a.target_id ? [a.target_id] : [],
      ),
    ),
  ];
  const tagIds = idsFor(["tag_added", "own_tag_removed"]);
  const memoryIds = idsFor(["memory_added"]);
  const personIds = idsFor([
    "person_claimed",
    "invitation_accepted",
    "people_merged",
  ]);

  const [tags, memories, people] = await Promise.all([
    tagIds.length
      ? supabase
          .from("tags")
          .select(
            `id, removed_at, person:people(full_name, slug), photo:photos(${PHOTO})`,
          )
          .in("id", tagIds)
      : { data: [] },
    memoryIds.length
      ? supabase
          .from("memories")
          .select(`id, body, hidden_at, photo:photos(${PHOTO})`)
          .in("id", memoryIds)
      : { data: [] },
    personIds.length
      ? supabase
          .from("people")
          .select("id, full_name, slug, claimed_by")
          .in("id", personIds)
      : { data: [] },
  ]);
  return {
    tags: new Map((tags.data ?? []).map((t) => [t.id, t])),
    memories: new Map((memories.data ?? []).map((m) => [m.id, m])),
    people: new Map((people.data ?? []).map((p) => [p.id, p])),
  };
}

type Targets = Awaited<ReturnType<typeof activityTargets>>;

// Admin changes to accounts, shown with the account they affected.
const ACCOUNT_ACTIONS: Record<string, (who: string, entry: Entry) => string> = {
  role_changed: (who, entry) =>
    payloadText(entry.data, "role") === "admin"
      ? `hizo admin a ${who}`
      : `quitó de admin a ${who}`,
  user_blocked: (who) => `bloqueó a ${who}`,
  user_unblocked: (who) => `desbloqueó a ${who}`,
};

function ActivityRow({
  entry,
  actor,
  subject,
  targets,
}: {
  entry: Entry;
  actor: string;
  subject: string;
  targets: Targets;
}) {
  const id = entry.target_id ?? "";
  let text: ReactNode =
    entry.action === "own_photo_withdrawn"
      ? "retiró una foto que había aportado"
      : (ACCOUNT_ACTIONS[entry.action]?.(subject, entry) ?? entry.action);
  let photo: PhotoRef | null = null;
  // [label, already undone]
  let undo: [string, boolean] | null = null;

  switch (entry.action) {
    case "tag_added":
    case "own_tag_removed": {
      const tag = targets.tags.get(id);
      photo = tag?.photo ?? null;
      if (entry.action === "own_tag_removed") {
        text = "se quitó su etiqueta";
      } else {
        text = tag?.person ? (
          <>
            etiquetó a{" "}
            <PersonLink slug={tag.person.slug} name={tag.person.full_name} />
          </>
        ) : (
          "marcó una cara sin identificar"
        );
        if (tag) undo = ["Deshacer", tag.removed_at !== null];
      }
      break;
    }
    case "memory_added": {
      const memory = targets.memories.get(id);
      photo = memory?.photo ?? null;
      text = memory ? (
        <>
          añadió un recuerdo:{" "}
          <q className="text-[#dadada]">{snippet(memory.body)}</q>
        </>
      ) : (
        "añadió un recuerdo"
      );
      if (memory) undo = ["Ocultar", memory.hidden_at !== null];
      break;
    }
    case "access_request_approved":
    case "access_request_rejected": {
      const name = payloadText(entry.data, "name") ?? "alguien";
      text =
        entry.action === "access_request_approved"
          ? `aprobó la solicitud de acceso de ${name}`
          : `rechazó la solicitud de acceso de ${name}`;
      break;
    }
    case "person_claimed":
    case "invitation_accepted": {
      const person = targets.people.get(id);
      const name = person ? (
        <PersonLink slug={person.slug} name={person.full_name} />
      ) : (
        "alguien"
      );
      const asAdmin = payloadText(entry.data, "role") === "admin";
      text =
        entry.action === "person_claimed" ? (
          <>dijo que es {name}</>
        ) : !entry.target_id ? (
          `aceptó la invitación${asAdmin ? " como admin" : " y entró al archivo"}`
        ) : (
          <>
            aceptó la invitación como {name}
            {asAdmin ? " (admin)" : ""}
          </>
        );
      if (person) {
        undo = ["Desvincular", person.claimed_by !== entry.actor_id];
      }
      break;
    }
    case "people_merged": {
      const person = targets.people.get(id);
      const merged = payloadText(entry.data, "merged_name") ?? "una persona";
      text = person ? (
        <>
          fusionó «{merged}» con{" "}
          <PersonLink slug={person.slug} name={person.full_name} />
        </>
      ) : (
        `fusionó «${merged}» con otra persona`
      );
      break;
    }
  }

  return (
    <li className="flex items-start gap-2.5 border-t border-line py-3 text-sm">
      <div className="min-w-0 flex-1">
        <strong className="font-semibold">{actor}</strong> {text}{" "}
        <span className="text-muted">
          · {photo ? `${photoLabel(photo)} · ` : ""}
          {timeAgo(entry.created_at)}
        </span>
      </div>
      {undo &&
        (undo[1] ? (
          <span className="flex-none py-3 text-[13px] text-muted">Hecho</span>
        ) : (
          <form action={undoActivity} className="flex-none">
            <input type="hidden" name="id" value={entry.id} />
            <button
              type="submit"
              className="inline-flex h-11 items-center px-2 text-[13px] font-medium text-accent"
            >
              {undo[0]}
            </button>
          </form>
        ))}
    </li>
  );
}

// Name of a tagged person, linking to their page with all their photos.
function PersonLink({ slug, name }: { slug: string; name: string }) {
  return (
    <Link
      href={`/persona/${slug}`}
      className="font-medium text-accent underline-offset-4 hover:underline"
    >
      {name}
    </Link>
  );
}

function snippet(text: string): string {
  return text.length > 80 ? `${text.slice(0, 77).trimEnd()}…` : text;
}
