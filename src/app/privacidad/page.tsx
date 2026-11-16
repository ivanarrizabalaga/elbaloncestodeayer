import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacidad",
  description:
    "Qué datos guarda El baloncesto de ayer, dónde y cómo puedes cambiarlos o borrarlos.",
};

// SPEC §11. Plain content: no data loading.
// The controller's real name is not in the repo (it is public): it comes from the environment.
const CONTACT = "hola@elbaloncestodeayer.com";

export default function PrivacyPage() {
  const controller = process.env.PRIVACY_CONTROLLER_NAME;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-8 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[44px] leading-none font-bold">
          Privacidad
        </h1>
        <p className="text-muted">
          El baloncesto de ayer es un archivo sin ánimo de lucro, hecho por
          aficionados. No hay publicidad, no vendemos nada y no rastreamos a
          nadie.
        </p>
      </div>

      <Section title="Quién está detrás">
        <p>
          {controller ? (
            <>
              Los responsables del archivo son <strong>{controller}</strong>.
            </>
          ) : (
            "El archivo lo llevan sus administradores."
          )}{" "}
          Para cualquier cosa sobre tus datos, escríbenos a{" "}
          <A href={`mailto:${CONTACT}`}>{CONTACT}</A>.
        </p>
        <p>Para tener cuenta hay que tener al menos 14 años.</p>
      </Section>

      <Section title="Qué guardamos">
        <p>
          <strong>Si solo miras las fotos,</strong> nada. No usamos analítica ni
          cookies de seguimiento.
        </p>
        <p>
          <strong>Si tienes cuenta,</strong> guardamos:
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Tu email, solo para mandarte los enlaces de acceso. No se muestra
            nunca.
          </li>
          <li>El nombre que eliges, que aparece junto a tus recuerdos.</li>
          <li>
            Si dijiste «Este soy yo», con qué persona del archivo está enlazada
            tu cuenta.
          </li>
          <li>
            Lo que aportas: etiquetas, recuerdos, nombres sugeridos y fotos.
          </li>
          <li>Quién te invitó.</li>
        </ul>
        <p>
          <strong>Si pides que se retire una foto,</strong> guardamos el motivo
          y, si los dejas, tu nombre y un contacto. Solo los ven los
          administradores, y solo para contestarte.
        </p>
        <p>
          La única cookie es la de la sesión, para que sigas dentro cuando
          entras.
        </p>
      </Section>

      <Section title="Tu nombre en las fotos">
        <p>
          Al decir «Este soy yo» o aceptar una invitación, aceptas que tu nombre
          aparezca en las fotos en las que estás etiquetado. Puedes quitar tu
          etiqueta de cualquier foto cuando quieras, y se quita al momento.
        </p>
      </Section>

      <Section title="Dónde están los datos">
        <ul className="ml-5 list-disc space-y-1">
          <li>Base de datos y cuentas: Supabase, en la UE (Irlanda).</li>
          <li>La web: Vercel, con los servidores en Dublín.</li>
          <li>Las imágenes: Cloudflare R2, en la UE.</li>
          <li>Los correos de acceso: Resend.</li>
        </ul>
      </Section>

      <Section title="Cómo cambiar o borrar algo">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Tu nombre:</strong> en <A href="/cuenta">Mi cuenta</A>.
          </li>
          <li>
            <strong>Una etiqueta tuya:</strong> en la foto, «Quitar mi
            etiqueta».
          </li>
          <li>
            <strong>Una foto que aportaste:</strong> en{" "}
            <A href="/proponer">Tus fotos</A> o en la propia foto, «Retirar esta
            foto». Es inmediato.
          </li>
          <li>
            <strong>Cualquier otra foto:</strong> en la foto, «Pedir que se
            retire esta foto». Lo revisamos con prioridad.
          </li>
          <li>
            <strong>Una copia de tus datos:</strong> pídenosla en{" "}
            <A href={`mailto:${CONTACT}`}>{CONTACT}</A> y te la mandamos en
            menos de un mes: tu cuenta, lo que has aportado y las fotos en las
            que sales.
          </li>
          <li>
            <strong>Tu cuenta:</strong> en <A href="/cuenta">Mi cuenta</A>,
            «Borrar mi cuenta». Se borran tus recuerdos y tus fotos sin
            publicar, y tu persona queda libre. Las etiquetas que pusiste se
            quedan, sin tu nombre, porque describen la foto.
          </li>
        </ul>
        <p>
          Para cualquier otra cosa, escríbenos a{" "}
          <A href={`mailto:${CONTACT}`}>{CONTACT}</A>.
        </p>
      </Section>

      <Section title="Las fotos">
        <p>
          Las fotos son de sus autores o de quien las aporta, no del archivo. El
          código de la web es libre (licencia MIT), pero esa licencia no cubre
          las fotos.
        </p>
        <p>
          <strong>Menores:</strong> el archivo es de fotos de antes. No
          publicamos fotos en las que salgan personas que hoy son menores de
          edad, salvo con permiso de sus padres, y nunca las etiquetamos con su
          nombre. Si ves alguna, pide que se retire y la quitamos.
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 text-[#dadada]">
      <h2 className="font-display text-[28px] leading-none font-bold text-fg">
        {title}
      </h2>
      {children}
    </section>
  );
}

function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-accent underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}
