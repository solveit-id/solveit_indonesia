import { render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getGsap, loadGsap, useMotion } from "./motion";

function Box({ onSetup }: { onSetup: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(
    ({ gsap }) => {
      onSetup();
      gsap.from(ref.current, { y: 20, opacity: 0, duration: 10 });
    },
    { scope: ref },
  );

  return <div ref={ref} data-testid="box" />;
}

const prefersReduced = (reduce: boolean) =>
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: reduce && query.includes("reduce"),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );

afterEach(() => vi.unstubAllGlobals());

describe("motion", () => {
  it("never runs, and never hides content, before GSAP has loaded", () => {
    prefersReduced(false);
    const onSetup = vi.fn();

    // In this file GSAP is loaded only by the next test, so it is absent here.
    expect(getGsap()).toBeNull();
    const { getByTestId } = render(<Box onSetup={onSetup} />);

    expect(onSetup).not.toHaveBeenCalled();
    expect(getByTestId("box").getAttribute("style")).toBeNull();
  });

  it("runs once loaded and reverts every inline style it set on unmount", async () => {
    prefersReduced(false);
    await loadGsap();
    const onSetup = vi.fn();
    const { getByTestId, unmount } = render(<Box onSetup={onSetup} />);
    const box = getByTestId("box");

    expect(onSetup).toHaveBeenCalledTimes(1);
    expect(box.style.opacity).toBe("0");

    unmount();
    expect(box.style.opacity).toBe("");
    expect(box.style.transform).toBe("");
  });

  it("does nothing when the reader asked for reduced motion", async () => {
    prefersReduced(true);
    await loadGsap();
    const onSetup = vi.fn();
    const { getByTestId } = render(<Box onSetup={onSetup} />);

    expect(onSetup).not.toHaveBeenCalled();
    expect(getByTestId("box").getAttribute("style")).toBeNull();
  });
});
