import type { FaqItem } from "~/types/content";

/**
 * Native disclosure list, shared by every FAQ: works without JavaScript, is
 * fully keyboard operable, and never closes on its own. Opening draws a
 * cobalt rule across the row and turns the plus into a minus; where the
 * browser supports animating `::details-content`, the answer also expands
 * and collapses smoothly, elsewhere it opens instantly (see `.faq` in app.css).
 */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="faq">
      {items.map((item) => (
        <details key={item.question} data-reveal className="faq-item">
          <summary className="faq-summary">
            <span className="faq-question">{item.question}</span>
            <span aria-hidden className="faq-icon">
              <span className="faq-icon-bar" />
              <span className="faq-icon-bar faq-icon-bar-cross" />
            </span>
          </summary>
          <div className="faq-answer">
            <p>{item.answer}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
