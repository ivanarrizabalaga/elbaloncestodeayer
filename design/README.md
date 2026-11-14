# Designs

Mockups of the main screens, exported from the design canvas. They are the **visual and behavioural reference**, not production code. Their copy is in Spanish, like the site's UI.

| File | Screen |
|---|---|
| `Main.dc.html` | Home / gallery (desktop) |
| `Foto.dc.html` | Photo page (desktop, interactive) |
| `Persona.dc.html` | Person page (desktop) |
| `FotoMovil.dc.html` | Photo page (mobile, 390 × 844) |
| `Invitacion.dc.html` | Invitation flow (mobile, interactive) |
| `AdminPendiente.dc.html` | Admin · Pending review (interactive) |
| `AdminSubir.dc.html` | Admin · Upload and tag |
| `AdminUsuarios.dc.html` | Admin · Users and admins (interactive) |

## How to read them

- It is HTML in the canvas's own template format: `{{value}}` is filled from `renderVals()` (the `<script type="text/x-dc">` block at the end), `<sc-if>` is a conditional and `<sc-for>` a loop. `support.js` is not included, so **they do not open as-is in a browser**.
- Styles are inline: that is where colours, sizes, spacing and radii come from (summarised in `SPEC.md` §3).
- The `renderVals()` logic describes the states of the interactive screens (tag selection, invitation steps, queue filters, invite-admin modal).
- The "photos" are placeholder SVG silhouettes and the names are examples. Anything in `[brackets]` is content still to be defined.
