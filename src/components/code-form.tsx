import { verifyCode } from "@/app/entrar/actions";

// Type the code from the email instead of opening the link (see verifyCode).
export function CodeForm({ next, retry }: { next: string; retry: string }) {
  return (
    <form action={verifyCode} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="retry" value={retry} />
      <label htmlFor="code" className="font-semibold">
        ¿Prefieres escribir el código?
      </label>
      <p className="text-sm text-muted">
        Si has entrado desde la app en la pantalla de inicio, escribe aquí los 6
        números del email en vez de pulsar el enlace.
      </p>
      <input
        id="code"
        name="code"
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        maxLength={7}
        placeholder="123456"
        className="min-h-11 rounded-xl border border-line-strong bg-surface px-4 text-center font-mono text-xl tracking-[0.3em] text-fg placeholder:text-muted/50"
      />
      <button
        type="submit"
        className="min-h-11 rounded-full border border-line-strong px-6 font-semibold"
      >
        Entrar con el código
      </button>
    </form>
  );
}
