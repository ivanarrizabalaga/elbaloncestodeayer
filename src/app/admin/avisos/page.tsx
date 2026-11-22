import type { Metadata } from "next";
import { MONTHLY_BUDGET, monthStart, PER_RUN } from "@/lib/mention-digest";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import { setMentionEmailsPaused } from "./actions";

export const metadata: Metadata = { title: "Avisos" };

const CARD = "flex flex-col gap-3 rounded-lg bg-surface p-5";
const H2 = "font-display text-[26px] leading-none font-bold";

// The mention emails (src/lib/mention-digest.ts): pause them, and see how many went out
// this month against the budget that keeps Resend's free tier for the sign-in emails.
export default async function NoticesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [settings, month, day, pending, last] = await Promise.all([
    supabase.from("mention_settings").select("paused").maybeSingle(),
    supabase
      .from("mention_emails")
      .select("id", { count: "exact", head: true })
      .gte("sent_at", monthStart()),
    supabase
      .from("mention_emails")
      .select("id", { count: "exact", head: true })
      .gte("sent_at", today.toISOString()),
    supabase
      .from("memory_mentions")
      .select("profile_id")
      .is("notified_at", null),
    supabase
      .from("mention_emails")
      .select("sent_at")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const paused = settings.data?.paused ?? false;
  const sentThisMonth = month.count ?? 0;
  const pendingMentions = pending.data?.length ?? 0;
  const pendingPeople = new Set(pending.data?.map((p) => p.profile_id)).size;
  const used = Math.min(sentThisMonth / MONTHLY_BUDGET, 1);
  const monthName = new Date().toLocaleDateString("es-ES", {
    month: "long",
    timeZone: "UTC",
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-8 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[40px] leading-none font-bold">
          Avisos de menciones
        </h1>
        <p className="text-muted">
          Cada mañana, quien tenga menciones nuevas en recuerdos recibe un solo
          email con todas. Como mucho {PER_RUN} emails al día y{" "}
          {MONTHLY_BUDGET.toLocaleString("es-ES")} al mes, para dejar siempre
          sitio a los emails para entrar (el plan gratuito de Resend permite 100
          al día y 3.000 al mes, entre todos).
        </p>
      </div>

      <section aria-labelledby="estado" className={CARD}>
        <h2 id="estado" className={H2}>
          {paused ? "En pausa" : "Activados"}
        </h2>
        <p>
          {paused
            ? "No se envía ningún email. Las menciones se guardan y saldrán cuando los reactives."
            : "Se envían cada mañana, entre las 8 y las 10 (hora de España)."}
        </p>
        <form action={setMentionEmailsPaused}>
          <input type="hidden" name="paused" value={paused ? "0" : "1"} />
          <button
            type="submit"
            className={`inline-flex h-11 items-center rounded-full px-5 font-semibold ${
              paused
                ? "bg-accent text-on-accent"
                : "border border-line-strong font-medium"
            }`}
          >
            {paused ? "Reactivar los avisos" : "Pausar los avisos"}
          </button>
        </form>
      </section>

      <section aria-labelledby="uso" className={CARD}>
        <h2 id="uso" className={H2}>
          Emails enviados
        </h2>
        <div className="flex flex-col gap-2">
          <p>
            <span className="text-2xl font-semibold">
              {sentThisMonth.toLocaleString("es-ES")}
            </span>{" "}
            <span className="text-muted">
              de {MONTHLY_BUDGET.toLocaleString("es-ES")} en {monthName}
            </span>
          </p>
          <div
            role="meter"
            aria-label="Emails de menciones este mes"
            aria-valuemin={0}
            aria-valuemax={MONTHLY_BUDGET}
            aria-valuenow={sentThisMonth}
            className="h-2 overflow-hidden rounded-full bg-surface-3"
          >
            <div
              className={`h-full ${used >= 0.9 ? "bg-accent" : "bg-fg/70"}`}
              style={{ width: `${used * 100}%` }}
            />
          </div>
        </div>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-5 gap-y-2 text-sm">
          <dt className="text-muted">Hoy</dt>
          <dd>
            {day.count ?? 0} de {PER_RUN}
          </dd>
          <dt className="text-muted">Pendientes</dt>
          <dd>
            {pendingMentions === 0
              ? "Ninguna"
              : `${pendingMentions} ${pendingMentions === 1 ? "mención" : "menciones"} para ${pendingPeople} ${pendingPeople === 1 ? "persona" : "personas"}`}
          </dd>
          <dt className="text-muted">Último envío</dt>
          <dd>{last.data ? timeAgo(last.data.sent_at) : "Todavía ninguno"}</dd>
        </dl>
        <p className="text-sm text-muted">
          Solo cuenta estos avisos. Los emails para entrar los envía Supabase y
          se ven en el panel de Resend. El mes es el natural (UTC).
        </p>
      </section>
    </main>
  );
}
