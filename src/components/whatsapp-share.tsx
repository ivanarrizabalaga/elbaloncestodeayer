// A plain link: WhatsApp opens with the text and URL ready to send.
export function WhatsAppShare({
  text,
  url,
  primary = false,
  className = "",
}: {
  text: string;
  url: string;
  primary?: boolean;
  className?: string;
}) {
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-5.5 ${
        primary
          ? "bg-accent font-semibold text-on-accent"
          : "border border-line-strong font-medium"
      } ${className}`}
    >
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
      </svg>
      Compartir por WhatsApp
    </a>
  );
}
