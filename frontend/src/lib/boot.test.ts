// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { BOOT_SEEN_KEY, bootLoaderScript, bootSettled } from "./boot";

interface Page {
  root: HTMLElement;
  fire: (type: "animationstart" | "animationend", name: string, times?: number) => void;
  storage: Storage;
}

/** A tab's sessionStorage, in memory. */
const memoryStorage = (): Storage => {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
};

const blockedStorage = new Proxy({} as Storage, {
  get: () => () => {
    throw new Error("SecurityError");
  },
});

/**
 * Runs the head fragment the way root.tsx embeds it, in a fresh document per
 * test (its listeners live on that document, so tests never leak into each
 * other). `storage: null` simulates blocked sessionStorage.
 */
const load = ({
  reduce = false,
  off = false,
  storage,
}: { reduce?: boolean; off?: boolean; storage?: Storage | null } = {}): Page => {
  const doc = document.implementation.createHTMLDocument("boot");
  const session = storage === null ? blockedStorage : (storage ?? memoryStorage());
  const win = { __solveitBoot: off ? "off" : undefined };
  const matchMedia = (query: string) => ({ matches: !reduce && /no-preference/.test(query) });
  new Function("d", "window", "document", "sessionStorage", "matchMedia", bootLoaderScript)(
    doc.documentElement,
    win,
    doc,
    session,
    matchMedia,
  );
  const fire: Page["fire"] = (type, name, times = 1) => {
    for (let i = 0; i < times; i++) {
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, "animationName", { value: name });
      doc.body.dispatchEvent(event);
    }
  };
  return { root: doc.documentElement, fire, storage: session };
};

describe("branded load sequence", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays the full sequence first, exits once all four capsules lock and the page is ready", async () => {
    vi.useFakeTimers();
    const { root, fire } = load();
    expect(root.dataset.boot).toBe("intro");
    expect(root.dataset.bootMode).toBe("full");
    fire("animationstart", "boot-capsule-in");
    await vi.advanceTimersByTimeAsync(10); // fonts ready (resolved promise in jsdom)
    fire("animationend", "boot-capsule-in", 3);
    await vi.advanceTimersByTimeAsync(0);
    expect(root.dataset.boot).toBe("intro"); // three of four capsules locked
    fire("animationend", "boot-capsule-in");
    await vi.advanceTimersByTimeAsync(0);
    expect(root.dataset.boot).toBe("exit");
    await vi.advanceTimersByTimeAsync(640);
    expect(root.dataset.boot).toBe("done");
  });

  it("plays the short sequence on a later load in the same tab", async () => {
    vi.useFakeTimers();
    const first = load();
    const again = load({ storage: first.storage });
    expect(first.storage.getItem(BOOT_SEEN_KEY)).toBe("1");
    expect(again.root.dataset.bootMode).toBe("short");
    again.fire("animationstart", "boot-capsule-in");
    again.fire("animationend", "boot-capsule-in", 4);
    await vi.advanceTimersByTimeAsync(0);
    expect(again.root.dataset.boot).toBe("exit");
    await vi.advanceTimersByTimeAsync(360);
    expect(again.root.dataset.boot).toBe("done");
  });

  it("treats every load as first when storage is blocked, and still runs", () => {
    const { root } = load({ storage: null });
    expect(root.dataset.boot).toBe("intro");
    expect(root.dataset.bootMode).toBe("full");
  });

  it("under reduced motion holds the still mark briefly, then fades", async () => {
    vi.useFakeTimers();
    const { root, fire } = load({ reduce: true });
    fire("animationstart", "boot-desc-in");
    fire("animationend", "boot-desc-in");
    await vi.advanceTimersByTimeAsync(400);
    expect(root.dataset.boot).toBe("intro");
    await vi.advanceTimersByTimeAsync(40);
    expect(root.dataset.boot).toBe("exit");
    await vi.advanceTimersByTimeAsync(320);
    expect(root.dataset.boot).toBe("done");
  });

  it("never stays up longer than the cap, even if the entrance never reports back", async () => {
    vi.useFakeTimers();
    const { root, fire } = load();
    fire("animationstart", "boot-capsule-in");
    await vi.advanceTimersByTimeAsync(2600);
    expect(root.dataset.boot).toBe("exit");
  });

  it("can be switched off by a test harness, leaving the page untouched", () => {
    const { root } = load({ off: true });
    expect(root.dataset.boot).toBeUndefined();
    expect(root.dataset.bootMode).toBeUndefined();
  });

  it("bootSettled resolves when the overlay starts to leave", async () => {
    document.documentElement.dataset.boot = "intro";
    let settled = false;
    void bootSettled().then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    document.documentElement.dataset.boot = "exit";
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(true);
    delete document.documentElement.dataset.boot;
  });
});
