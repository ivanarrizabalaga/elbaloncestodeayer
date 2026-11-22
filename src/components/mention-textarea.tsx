"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PersonOption } from "@/components/person-picker";
import { decodeMentions, encodeMentions, type Mention } from "@/lib/mentions";
import { fold } from "@/lib/slug";

type Props = {
  id: string;
  // People in the archive to mention (src/lib/people.ts).
  people: PersonOption[];
  // Stored body, with mention tokens (when editing).
  defaultBody?: string;
  rows?: number;
  placeholder?: string;
  className?: string;
};

// A memory's textarea where «@» + a few letters offers people from the archive. The list
// goes under the textarea (easier on a phone than a popup at the cursor). The form gets the
// body with mention tokens in a hidden «body» field.
export function MentionTextarea({
  id,
  people,
  defaultBody = "",
  rows = 3,
  placeholder,
  className = "",
}: Props) {
  const initial = useMemo(() => decodeMentions(defaultBody), [defaultBody]);
  const [text, setText] = useState(initial.text);
  const [mentions, setMentions] = useState<Mention[]>(initial.mentions);
  // The «@…» being typed: where its «@» is, where the cursor is, and the letters.
  const [query, setQuery] = useState<{
    start: number;
    end: number;
    q: string;
  } | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLUListElement>(null);

  // React resets the form after its action; the text here is state, so follow suit.
  useEffect(() => {
    const form = textarea.current?.form;
    if (!form) return;
    function onReset() {
      setText(initial.text);
      setMentions(initial.mentions);
      setQuery(null);
    }
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [initial]);

  const matches = useMemo(() => {
    const q = fold(query?.q.trim() ?? "");
    if (!q) return [];
    return people.filter((p) => fold(p.name).includes(q)).slice(0, 5);
  }, [people, query]);

  function track(value: string, caret: number) {
    const match = value
      .slice(0, caret)
      .match(/(?:^|\s)@([^@\s][^@\n]{0,40})?$/);
    setQuery(
      match
        ? {
            start: caret - (match[1]?.length ?? 0) - 1,
            end: caret,
            q: match[1] ?? "",
          }
        : null,
    );
  }

  function pick(person: PersonOption) {
    if (!query) return;
    const inserted = `@${person.name} `;
    const value = text.slice(0, query.start) + inserted + text.slice(query.end);
    setText(value);
    setMentions((current) =>
      current.some((m) => m.id === person.id)
        ? current
        : [...current, { id: person.id, name: person.name }],
    );
    setQuery(null);
    const caret = query.start + inserted.length;
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(caret, caret);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={textarea}
        id={id}
        rows={rows}
        required
        // Tokens make the stored body longer than what is typed (limit 4000).
        maxLength={3600}
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          track(event.target.value, event.target.selectionStart);
        }}
        onSelect={(event) =>
          track(event.currentTarget.value, event.currentTarget.selectionStart)
        }
        onKeyDown={(event) => {
          if (matches.length === 0) return;
          if (event.key === "Escape") setQuery(null);
          if (event.key === "ArrowDown") {
            event.preventDefault();
            list.current?.querySelector("button")?.focus();
          }
        }}
        aria-describedby={`${id}-hint`}
        className={className}
      />
      <input type="hidden" name="body" value={encodeMentions(text, mentions)} />
      {matches.length > 0 && (
        <ul
          ref={list}
          aria-label="Mencionar a"
          className="flex flex-col rounded-lg border border-line-strong bg-surface-2 p-1"
        >
          {matches.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => pick(person)}
                onKeyDown={(event) => {
                  const item = event.currentTarget.parentElement;
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    item?.nextElementSibling?.querySelector("button")?.focus();
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    const previous = item?.previousElementSibling;
                    (
                      previous?.querySelector("button") ?? textarea.current
                    )?.focus();
                  } else if (event.key === "Escape") {
                    setQuery(null);
                    textarea.current?.focus();
                  }
                }}
                className="flex min-h-11 w-full flex-col justify-center rounded-md px-2 text-left hover:bg-surface-3 focus-visible:bg-surface-3"
              >
                <span className="font-medium">{person.name}</span>
                <span className="text-xs text-muted">{person.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p id={`${id}-hint`} className="text-xs text-muted">
        Escribe @ y un nombre para mencionar a alguien del archivo.
      </p>
    </div>
  );
}
