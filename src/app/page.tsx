// Placeholder home page until phase 2 builds the real gallery (design/Main.dc.html).
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="font-display text-5xl font-bold uppercase tracking-wide sm:text-6xl">
        El baloncesto <span className="text-accent">de ayer</span>
      </h1>
      <p className="max-w-prose text-lg text-muted">
        Archivo fotográfico colaborativo del baloncesto de antes. Estamos
        preparando la web: muy pronto podrás reconocerte en las fotos, etiquetar
        a tus compañeros e invitarles.
      </p>
      <a
        href="https://www.instagram.com/explore/tags/elbaloncestodeayer/"
        className="inline-flex min-h-11 w-fit items-center rounded-full bg-accent px-6 font-semibold text-on-accent"
      >
        Mientras tanto, en Instagram
      </a>
    </main>
  );
}
