const relative = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

// «hace 5 minutos», «ayer», «hace 3 días»; older than a month: «12 nov 2026».
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  if (Math.abs(seconds) < 60) return "ahora mismo";
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  if (Math.abs(days) < 30) return relative.format(days, "day");
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
