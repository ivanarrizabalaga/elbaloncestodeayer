# CLAUDE.md

Guía para trabajar en este repo. Lee primero [`SPEC.md`](SPEC.md): ahí está qué construimos y por qué.

## Principio número uno

**Lo más sencillo que funcione.** El mantenedor prefiere «pecar de sencillo» antes que algo sofisticado que luego no se pueda mantener. Antes de añadir una dependencia, una capa o una abstracción, pregúntate si de verdad hace falta; si dudas, no la añadas y coméntalo en el PR.

## Stack

- Next.js (App Router) + TypeScript (strict) + Tailwind CSS.
- Supabase: Postgres, Auth (enlace mágico) y RLS, usando `@supabase/ssr` / `@supabase/supabase-js`. Sin ORM.
- Cloudflare R2 (API S3) para imágenes; `sharp` para generar derivados en el servidor.
- Despliegue en Vercel.

## Convenciones

- **Idioma:** textos de la interfaz en español de España. Código, nombres de tablas/columnas, identificadores y mensajes de commit en inglés. La documentación del repo, en español.
- **Componentes de servidor por defecto.** Componentes de cliente solo donde haya interacción real (etiquetado sobre la foto, formularios, pestañas).
- **Mutaciones con Server Actions** o route handlers sencillos. Sin librerías de estado global ni de fetching.
- **Estilos con Tailwind** usando los tokens de color y tipografía de `SPEC.md` (§3, Identidad visual), definidos una vez en la config del tema.
- **Base de datos:** cada cambio de esquema es una migración SQL en `supabase/migrations/`. Tipos generados con la CLI de Supabase, no a mano.
- **Accesibilidad:** elementos reales (`<button>`, `<a>`, `<label>`), `alt` en las imágenes, foco visible, objetivos táctiles ≥ 44 px, contraste AA.
- **Móvil primero:** la mayoría llegará desde un enlace de WhatsApp.

## Seguridad (no negociable)

- **RLS en todas las tablas.** Los permisos de `SPEC.md` §2 se aplican en las políticas de Postgres, no solo en la interfaz.
- Las comprobaciones de admin se hacen en el servidor **y** en RLS.
- La clave `service_role` de Supabase y las de R2 solo existen en el servidor (variables de entorno). Nunca en el cliente, nunca en el repo.
- Mantén `.env.example` al día con los nombres de las variables (sin valores).

## Contenido real: nunca en el repo

El repo es público. **No commitees** fotos reales, nombres reales, el export de Instagram ni volcados de la base de datos. Los datos de prueba (`seed`) usan nombres inventados e imágenes de relleno. Si ves algo así preparado para commit, para y avisa.

## Diseños

Los mockups están en `design/*.dc.html`. Son la referencia visual y de comportamiento, **no código para copiar**: usan un formato de plantilla propio del lienzo de diseño (`{{...}}`, `<sc-if>`, `<sc-for>`, estilos en línea). Léelos para sacar la estructura, los textos, los estados y los estilos, y constrúyelos con componentes React + Tailwind. Ver `design/README.md`.

## Forma de trabajar

- Una fase de `SPEC.md` §9 por rama y PR. PRs pequeños y revisables.
- Si una decisión cambia algo de `SPEC.md`, actualízalo en el mismo PR.
- Antes de dar algo por terminado: `lint`, `typecheck` y `build` sin errores. (Comandos exactos: se añaden aquí en la fase 1.)
- Si algo de la especificación no está claro, pregunta antes de inventar.
