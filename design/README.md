# Diseños

Mockups de las pantallas principales, exportados del lienzo de diseño. Son la **referencia visual y de comportamiento**, no código de producción.

| Fichero | Pantalla |
|---|---|
| `Main.dc.html` | Inicio / galería (escritorio) |
| `Foto.dc.html` | Ficha de foto (escritorio, interactiva) |
| `Persona.dc.html` | Página de persona (escritorio) |
| `FotoMovil.dc.html` | Ficha de foto (móvil, 390 × 844) |
| `Invitacion.dc.html` | Flujo de invitación (móvil, interactivo) |
| `AdminPendiente.dc.html` | Admin · Pendiente de revisar (interactiva) |
| `AdminSubir.dc.html` | Admin · Subir y etiquetar |
| `AdminUsuarios.dc.html` | Admin · Usuarios y administradores (interactiva) |

## Cómo leerlos

- Es HTML con un formato de plantilla propio del lienzo: `{{valor}}` se rellena desde `renderVals()` (el bloque `<script type="text/x-dc">` al final), `<sc-if>` es un condicional y `<sc-for>` un bucle. `support.js` no está incluido, así que **no se abren tal cual en el navegador**.
- Los estilos van en línea: de ahí salen colores, tamaños, espaciados y radios (resumidos en `SPEC.md` §3).
- La lógica de `renderVals()` describe los estados de las pantallas interactivas (selección de etiqueta, pasos de la invitación, filtros de la cola, modal de invitar admin).
- Las «fotos» son siluetas SVG de relleno y los nombres son de ejemplo. Lo que va entre `[corchetes]` es contenido por definir.
