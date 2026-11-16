// A plain link: WhatsApp opens with the text and URL ready to send.
export function WhatsAppShare({
  text,
  url,
  className = "",
}: {
  text: string;
  url: string;
  className?: string;
}) {
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-full bg-whatsapp px-5.5 font-semibold text-bg ${className}`}
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
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      </svg>
      Compartir por WhatsApp
    </a>
  );
}
