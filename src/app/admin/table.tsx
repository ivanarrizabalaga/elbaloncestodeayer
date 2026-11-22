import Link from "next/link";
import type { ReactNode } from "react";

// Pieces shared by the admin list pages.

export function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`-mb-px flex min-h-11 items-center border-b-2 px-3 text-sm font-medium ${
        active
          ? "border-accent text-fg"
          : "border-transparent text-muted hover:text-fg"
      }`}
    >
      {children}
    </Link>
  );
}

// Wide tables scroll sideways on phones instead of squashing. With `widths` (one class per
// column) the layout is fixed, so columns don't jump when a filter changes the rows.
export function Table({
  head,
  widths,
  children,
}: {
  head: string[];
  widths?: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg bg-surface">
      <table
        className={`w-full min-w-[860px] text-left text-sm ${widths ? "table-fixed" : ""}`}
      >
        <thead className="text-xs text-muted">
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`px-4 py-3 font-medium ${widths?.[i] ?? ""}`}
              >
                {i === head.length - 1 ? (
                  <span className="sr-only">{h}</span>
                ) : (
                  h
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 align-middle">{children}</td>;
}

export function Chip({
  children,
  muted = false,
  danger = false,
}: {
  children: ReactNode;
  muted?: boolean;
  danger?: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${
        danger
          ? "border border-danger text-danger"
          : muted
            ? "border border-line-strong text-muted"
            : "bg-surface-3 text-accent"
      }`}
    >
      {children}
    </span>
  );
}
