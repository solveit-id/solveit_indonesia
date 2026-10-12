import { Plus } from "@phosphor-icons/react/dist/ssr/Plus";
import type { FaqItem } from "~/types/content";

/** Native disclosure list: works without JavaScript and is fully keyboard operable. */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="border-t border-line">
      {items.map((item) => (
        <details key={item.question} className="group border-b border-line">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 text-lg font-semibold [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <Plus
              aria-hidden
              weight="bold"
              className="mt-1 size-5 shrink-0 text-accent-text transition-transform duration-300 group-open:rotate-45"
            />
          </summary>
          <p className="measure pb-7 text-ink-muted">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
