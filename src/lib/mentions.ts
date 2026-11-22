// Mentions in memories (SPEC §12). Stored inside the body as «@[Pepe García](person id)»:
// the name is the one shown when it was written; pages show the person's current name and
// link to them. Editors show «@Pepe García» and turn it back into the token on save.

export type Mention = { id: string; name: string };
export type BodyPart = string | Mention;

const TOKEN =
  /@\[([^\]\n]{1,200})\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/g;

// Text and mentions, in order.
export function parseBody(body: string): BodyPart[] {
  const parts: BodyPart[] = [];
  let last = 0;
  for (const match of body.matchAll(TOKEN)) {
    if (match.index > last) parts.push(body.slice(last, match.index));
    parts.push({ name: match[1], id: match[2] });
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}

export function mentionIds(bodies: string[]): string[] {
  return [
    ...new Set(
      bodies.flatMap((body) =>
        parseBody(body).flatMap((part) =>
          typeof part === "string" ? [] : [part.id],
        ),
      ),
    ),
  ];
}

// Plain text, for snippets: «@[Pepe García](id)» → «Pepe García».
export function plainBody(body: string): string {
  return parseBody(body)
    .map((part) => (typeof part === "string" ? part : part.name))
    .join("");
}

// For editing: the text as typed («@Pepe García») and the mentions it holds.
export function decodeMentions(body: string): {
  text: string;
  mentions: Mention[];
} {
  const parts = parseBody(body);
  return {
    text: parts
      .map((part) => (typeof part === "string" ? part : `@${part.name}`))
      .join(""),
    mentions: parts.filter((part): part is Mention => typeof part !== "string"),
  };
}

// Back to the stored form: every «@Name» of a picked mention still in the text becomes a
// token. A name edited by hand no longer matches and stays plain text.
export function encodeMentions(text: string, mentions: Mention[]): string {
  if (mentions.length === 0) return text;
  const byName = new Map(mentions.map((m) => [m.name, m]));
  // Longest names first, so «@Pepe García López» wins over «@Pepe García».
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(
    `@(${names.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`,
    "gu",
  );
  return text.replace(
    pattern,
    (_, name: string) => `@[${name}](${byName.get(name)!.id})`,
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
