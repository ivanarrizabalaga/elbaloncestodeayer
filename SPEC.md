# El baloncesto de ayer — Especificación

Archivo fotográfico colaborativo del baloncesto de antes. Empezó con la colección de Jorge (publicada en Instagram como **#elbaloncestodeayer**) y crece con lo que aporta la gente que sale en las fotos.

La idea central: **alguien te etiqueta en una foto → te llega un enlace → te reconoces, entras → etiquetas a tus compañeros y les invitas.** Así el archivo crece solo.

No se trata de monetizar, se trata de compartir.

---

## 1. Principios

1. **Sencillo y mantenible antes que sofisticado.** Si dudamos entre dos opciones, gana la que se pueda entender y mantener un domingo por la tarde.
2. **Coste ~0 €.** Planes gratuitos (Vercel Hobby, Supabase Free, Cloudflare R2 Free) más el dominio.
3. **La web es el archivo; Instagram es el escaparate.** Nada de sincronización en tiempo real con Instagram.
4. **El código es abierto; el contenido no.** Fotos, nombres reales y exports nunca entran en el repo.
5. **Privacidad por defecto.** Cualquiera puede quitarse su etiqueta al momento y pedir que se retire una foto. Datos en la UE.
6. **Las fotos mandan.** Interfaz oscura, discreta, sin adornos.

---

## 2. Roles y permisos

Dos roles: **usuario** y **admin**. Todos los admins pueden exactamente lo mismo. Los visitantes sin cuenta solo miran.

| Acción | Visitante | Usuario | Admin |
|---|:-:|:-:|:-:|
| Ver fotos, personas, fichas | ✓ | ✓ | ✓ |
| Etiquetar a alguien en una foto (se publica al momento) | | ✓ | ✓ |
| Sugerir nombre para una cara «?» | | ✓ (va a revisión) | ✓ (directo) |
| Añadir un recuerdo a una foto (se publica al momento) | | ✓ | ✓ |
| Invitar a una persona etiquetada | | ✓ | ✓ |
| Reclamar su perfil de persona («Este soy yo») | | ✓ | ✓ |
| Quitarse su propia etiqueta (inmediato) | | ✓ | ✓ |
| Pedir la retirada de una foto | ✓ (formulario) | ✓ | ✓ |
| Proponer fotos | | ✓ (va a revisión) | — |
| Subir, editar, publicar y retirar fotos | | | ✓ |
| Revisar la cola de pendientes | | | ✓ |
| Deshacer etiquetas / ocultar recuerdos | | | ✓ |
| Crear, editar y fusionar personas | | | ✓ |
| Hacer admin, quitar admin, invitar admins | | | ✓ |
| Bloquear usuarios | | | ✓ |

Reglas:
- Siempre debe quedar **al menos un admin**.
- Un usuario bloqueado no puede etiquetar ni proponer, pero lo que ya aportó se queda.
- Lo que se publica sin revisión aparece en **Actividad reciente** del admin y se puede deshacer.

---

## 3. Pantallas

Los mockups están en [`design/`](design/) (ver `design/README.md` para leerlos). Son la referencia visual y de comportamiento.

### Públicas
| Pantalla | Mockup | Qué hace |
|---|---|---|
| Inicio / galería | `Main.dc.html` | Foto de la semana, filtros (década, equipo, pabellón, «solo caras sin nombre»), galería en mosaico, bloque «Ayuda a ponerles nombre» |
| Ficha de foto | `Foto.dc.html`, `FotoMovil.dc.html` | Foto con marcadores numerados sobre las caras, lista «En la foto» (perfil propio / Invitar / Sé quién es), datos, historia, recuerdos, «Más de esta temporada», enlaces de privacidad |
| Página de persona | `Persona.dc.html` | Nombre, recorte de la cara, «Sale con», fotos por temporada, compartir, invitar |
| Invitación | `Invitacion.dc.html` | Llega por enlace (WhatsApp): ¿Eres tú? → email → enlace mágico → dentro. También «No soy yo» |

### Admin
| Pantalla | Mockup | Qué hace |
|---|---|---|
| Pendiente de revisar | `AdminPendiente.dc.html` | Cola: fotos propuestas, nombres sugeridos, retiradas (prioritarias), «No soy yo», posibles duplicados. «Me lo quedo» para repartir. Actividad reciente con deshacer |
| Subir y etiquetar | `AdminSubir.dc.html` | Subida múltiple a borrador, clic en una cara → buscar persona existente / crear nueva / dejar como «?». Datos de la foto. Publicar |
| Usuarios y admins | `AdminUsuarios.dc.html` | Lista de admins (con invitaciones pendientes) y de usuarios. Invitar administrador, hacer/quitar admin, bloquear |
| Personas | _(sin mockup)_ | Listado, editar, fusionar duplicados |
| Fotos | _(sin mockup)_ | Listado con estado (borrador, publicada, retirada), buscar, editar |
| Importar de Instagram | _(sin mockup)_ | Uso puntual: cargar el export de Jorge como borradores |

### Identidad visual (de los mockups)
- Fondo `#0E0E0E`, superficies `#161616`/`#181818`/`#1C1C1C`, bordes `#262626`/`#3A3A3A`.
- Texto `#F2F2F2`, secundario `#A6A6A6`.
- Acento único: naranja balón `#FF7A1A` (texto sobre naranja: `#0E0E0E`).
- Tipografía: **Barlow Condensed** (títulos, 600–700) + **Inter** (texto).
- Botones en píldora, objetivos táctiles ≥ 44 px, contraste AA.

---

## 4. Modelo de datos (Postgres / Supabase)

Nombres en inglés. Todas las tablas con RLS activado.

**profiles** — una fila por usuario con cuenta (`id` = `auth.users.id`)
- `display_name`, `role` (`user` | `admin`), `person_id` (nullable, único: la persona que ha reclamado), `invited_by`, `blocked_at`, `created_at`

**people** — personas que salen en las fotos (con o sin cuenta)
- `full_name`, `slug`, `bio`, `claimed_by` (profile, nullable), `merged_into` (nullable), `created_by`, `created_at`

**photos**
- `slug`, `status` (`proposed` | `draft` | `published` | `rejected` | `withdrawn`)
- `season_label` (texto libre, p. ej. «1984–85»), `year_from`, `year_to` (para filtrar por década)
- `team`, `venue`, `competition` (texto libre con autocompletado a partir de valores existentes; normalizar más adelante solo si hace falta)
- `provenance`, `photographer`, `story`, `instagram_url`, `featured`
- `storage_key`, `width`, `height`
- `proposed_by`, `published_by`, `published_at`, `created_at`

**tags** — una cara en una foto
- `photo_id`, `person_id` (nullable = cara sin identificar «?»), `x`, `y` (0–1, relativos a la imagen), `label_number`
- `created_by`, `created_at`, `removed_by`, `removed_at` (borrado lógico para poder deshacer)

**memories** — recuerdos / anécdotas
- `photo_id`, `author_id`, `body`, `hidden_at`, `created_at`

**invitations**
- `token_hash`, `role` (`user` | `admin`), `person_id` (nullable), `tag_id` (nullable: desde qué etiqueta se invitó), `email` (nullable), `invited_by`, `created_at`, `expires_at` (7 días), `accepted_at`, `accepted_by`

**review_items** — la cola de «Pendiente»
- `kind` (`photo_proposal` | `name_suggestion` | `removal_request` | `tag_dispute` | `duplicate_person`)
- `status` (`open` | `resolved` | `dismissed`), `priority` (bool; `removal_request` siempre prioritaria)
- `photo_id`, `tag_id`, `person_id`, `payload` (jsonb: nombre propuesto, motivo, persona duplicada…)
- `created_by`, `assigned_to`, `resolved_by`, `resolved_at`, `created_at`

**activity** — registro para «Actividad reciente» y deshacer
- `actor_id`, `action`, `target_type`, `target_id`, `data` (jsonb), `created_at`

---

## 5. Flujos clave

**Invitación**
1. Alguien etiqueta a «Pepe» y pulsa *Invitar* → se crea una `invitation` ligada a la persona → enlace para compartir por WhatsApp (con texto prerrellenado).
2. Pepe abre el enlace → ve la foto con su cara marcada → «¿Eres tú?».
3. *Sí* → email → enlace mágico (Supabase Auth) → acepta que su nombre aparezca → su `profile` queda ligado a la `person` → bienvenida.
4. *No soy yo* → crea un `review_item` de tipo `tag_dispute` (puede proponer el nombre correcto).

**Invitar admin** — igual, con `role = admin`; si el email ya tiene cuenta, se le promociona al aceptar.

**Quitarse la etiqueta** — inmediato (`removed_at`), queda en `activity`.

**Retirada de foto** — `review_item` prioritario; el admin la pasa a `withdrawn` (deja de verse; no se borra el original hasta confirmarlo).

**Nombre sugerido** — `review_item`; al aceptar se asigna la persona existente o se crea una nueva.

**Duplicados** — el admin fusiona: las etiquetas pasan a la persona destino y la otra queda con `merged_into`.

---

## 6. Imágenes

- Almacenamiento en **Cloudflare R2**.
- Al subir se generan en el servidor (con `sharp`) dos derivados: **miniatura** (~480 px) y **grande** (~1600 px), en WebP.
- Los derivados se sirven públicos desde R2; el **original** se guarda en un prefijo privado.
- Subida directa del navegador a R2 con URL prefirmada; el procesado se hace después en el servidor.
- Nada de transformaciones al vuelo de pago.

---

## 7. Importar de Instagram

Una sola vez, a partir del export de la cuenta de Jorge (Instagram → «Descargar tu información», formato JSON):
- Script o pantalla de admin que crea una foto en **borrador** por publicación, con el texto como `story` y el enlace original.
- Opcional: extraer del texto nombres y años para prerrellenar (siempre revisado por un admin).
- El export **nunca** se sube al repo (`instagram-export/` está en `.gitignore`).

---

## 8. Infraestructura

- **Next.js** (App Router, TypeScript, Tailwind) en **Vercel** (Hobby).
- **Supabase**: Postgres + Auth (enlace mágico por email) + RLS. Proyecto en región **UE (Frankfurt)**.
- **Cloudflare R2** para imágenes.
- **Cron diario** (Vercel Cron) que hace una consulta ligera para que Supabase Free no pause el proyecto.
- Migraciones SQL versionadas en `supabase/migrations/`.
- Copias de seguridad: export periódico de la base de datos (a definir en la fase 6).

---

## 9. Fases

1. **Esqueleto** — Next.js, esquema y RLS, login con enlace mágico, despliegue en Vercel, cron anti-pausa.
2. **Web pública de solo lectura** — Inicio, ficha de foto, página de persona, con datos de prueba (`seed`).
3. **Admin: subir y etiquetar** — subida a R2, derivados, etiquetado sobre la foto, borrador → publicada.
4. **Importar de Instagram** — Jorge carga su archivo real.
5. **Comunidad** — invitaciones, reclamar perfil, etiquetado de usuarios, cola de pendientes, actividad, gestión de admins.
6. **Remates** — privacidad y retirada, copias de seguridad, foto de la semana, SEO básico, compartir en WhatsApp con buena vista previa.

Cada fase en una rama con su PR.

---

## 10. Fuera de alcance (por ahora)

- Reconocimiento facial automático (datos biométricos; no compensa).
- Publicación automática en Instagram.
- «Me gusta», seguidores, mensajes privados.
- Apps nativas, varios idiomas.

---

## 11. Privacidad

- Al reclamar el perfil, la persona acepta que su nombre aparezca en las fotos donde la etiqueten.
- Quitarse una etiqueta es inmediato; pedir la retirada de una foto llega como prioritario.
- Página de privacidad con quién gestiona el archivo y cómo pedir cambios.
- Sin cookies de seguimiento ni analítica invasiva.
- La licencia MIT del repo cubre **solo el código**; las fotos pertenecen a sus autores o a quien las aporta.
