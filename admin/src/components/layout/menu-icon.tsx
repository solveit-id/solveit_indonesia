import { X } from "@phosphor-icons/react/dist/csr/X";

/**
 * Two capsule bars on the logo's 33 degree axis (the website's menu glyph), authored so it
 * matches the capsule language instead of a stock hamburger; a close glyph while open.
 */
export function MenuIcon({ open }: { open: boolean }) {
  if (open) {
    return <X aria-hidden size={20} weight="bold" />;
  }

  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" focusable="false">
      <rect
        x="3"
        y="8.2"
        width="15"
        height="2.6"
        rx="1.3"
        fill="currentColor"
        transform="rotate(-33 10.5 9.5)"
      />
      <rect
        x="6"
        y="13.2"
        width="15"
        height="2.6"
        rx="1.3"
        fill="currentColor"
        transform="rotate(-33 13.5 14.5)"
      />
    </svg>
  );
}
