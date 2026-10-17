import { describe, expect, it } from "vitest";
import { deviceLabel } from "./user-agent";

describe("deviceLabel", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.8078.4 Safari/537.36",
      "Chrome 156, Windows",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
      "Edge 140, Windows",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
      "Safari 18, macOS",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1",
      "Safari 18, iOS",
    ],
    [
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36",
      "Chrome 156, Android",
    ],
    [
      "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
      "Firefox 140, Linux",
    ],
  ])("%s", (agent, label) => {
    expect(deviceLabel(agent)).toBe(label);
  });

  it("guesses nothing for an unknown or missing agent", () => {
    expect(deviceLabel("curl/8.9.1")).toBeNull();
    expect(deviceLabel(null)).toBeNull();
    expect(deviceLabel("  ")).toBeNull();
  });
});
