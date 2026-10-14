/**
 * Deterministic scrollspy: one function of the scroll position decides the
 * single current chapter, so overlapping triggers can never fight over it.
 *
 * `tops` are the chapters' top edges in viewport coordinates, in reading
 * order. The current chapter is the last one whose top has crossed the
 * reading line: a chapter stays current while the reader is in its body or
 * in the gap after it, until the next heading reaches the line, whatever the
 * chapters' sizes. Before the first chapter there is none. At the bottom of
 * the page, where trailing chapters may never reach the line, the last
 * chapter that has come into view wins.
 */
export function pickChapter<T extends string>(
  chapters: readonly { id: T; top: number }[],
  { line, viewport, atBottom }: { line: number; viewport: number; atBottom: boolean },
): T | null {
  let current: T | null = null;
  for (const chapter of chapters) {
    if (chapter.top <= line || (atBottom && chapter.top < viewport)) current = chapter.id;
    else break;
  }
  return current;
}

/**
 * Where the reader's eye rests: just under the sticky header, a little
 * below the top of what remains (22 percent). Anchored chapters land 1.5rem
 * under the header (their scroll-margin), always above this line, so a chapter
 * reached from the rail is the current one.
 */
export const readingLine = (headerBottom: number, viewport: number) =>
  headerBottom + Math.max(0, viewport - headerBottom) * 0.22;

/** Document offset that ignores transforms (entrance offsets never skew it). */
export function documentTop(element: HTMLElement): number {
  let top = 0;
  for (let node: HTMLElement | null = element; node; node = node.offsetParent as HTMLElement | null)
    top += node.offsetTop;
  return top;
}
