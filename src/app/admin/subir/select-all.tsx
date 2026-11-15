"use client";

import { useEffect, useRef, useState } from "react";

// «Seleccionar todas» for the drafts table: ticks every row checkbox of the form and shows
// how many are selected. The rows themselves are plain checkboxes (name="id").
export function SelectAll({ form }: { form: string }) {
  const box = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const element = document.getElementById(form);
    if (!(element instanceof HTMLFormElement)) return;
    const rows = () => [
      ...element.querySelectorAll<HTMLInputElement>('input[name="id"]'),
    ];
    const update = () => {
      const all = rows();
      const ticked = all.filter((input) => input.checked).length;
      setSelected(ticked);
      setTotal(all.length);
      if (box.current) {
        box.current.checked = all.length > 0 && ticked === all.length;
        box.current.indeterminate = ticked > 0 && ticked < all.length;
      }
    };
    update();
    element.addEventListener("change", update);
    return () => element.removeEventListener("change", update);
  }, [form]);

  function toggle(checked: boolean) {
    const element = document.getElementById(form);
    if (!(element instanceof HTMLFormElement)) return;
    for (const input of element.querySelectorAll<HTMLInputElement>(
      'input[name="id"]',
    )) {
      input.checked = checked;
    }
    element.dispatchEvent(new Event("change"));
  }

  return (
    <label className="inline-flex h-11 cursor-pointer items-center gap-3 text-sm font-medium">
      <input
        ref={box}
        type="checkbox"
        onChange={(event) => toggle(event.target.checked)}
        className="size-4.5 accent-accent"
      />
      {selected > 0
        ? `${selected} de ${total} seleccionadas`
        : "Seleccionar todas"}
    </label>
  );
}
