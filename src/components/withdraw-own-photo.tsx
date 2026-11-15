import { withdrawOwnPhoto } from "@/app/proponer/actions";

// A <details> instead of a confirm() dialog: works without JavaScript and is one more tap.
export function WithdrawOwnPhoto({
  id,
  published,
}: {
  id: string;
  published: boolean;
}) {
  return (
    <details className="text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-muted">
        Retirar esta foto
      </summary>
      <form
        action={withdrawOwnPhoto}
        className="flex flex-col items-start gap-2"
      >
        <input type="hidden" name="id" value={id} />
        <p className="text-muted">
          {published
            ? "Dejará de verse en la web al momento. Las etiquetas y los recuerdos de otros se guardan, ocultos."
            : "Se borrará del todo, sin pasar por revisión."}
        </p>
        <button
          type="submit"
          className="inline-flex h-11 items-center rounded-full border border-accent px-4 font-semibold text-accent"
        >
          Sí, retirarla
        </button>
      </form>
    </details>
  );
}
