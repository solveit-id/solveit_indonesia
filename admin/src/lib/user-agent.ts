/**
 * A short device name ("Chrome 156, Windows") from the user agent Laravel recorded for a
 * session, so a person can tell which session to end. Only a reading aid: the raw string is
 * shown beside it, and an unrecognised agent gets null rather than a guess.
 */
const browsers: [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\/(\d+)/, "Edge"],
  [/\bOPR\/(\d+)/, "Opera"],
  [/\bSamsungBrowser\/(\d+)/, "Samsung Internet"],
  [/\bFirefox\/(\d+)/, "Firefox"],
  [/\bFxiOS\/(\d+)/, "Firefox"],
  [/\bCriOS\/(\d+)/, "Chrome"],
  [/\bChrome\/(\d+)/, "Chrome"],
  [/\bVersion\/(\d+)(?:\.\d+)*.*\bSafari\//, "Safari"],
];

const systems: [RegExp, string][] = [
  [/\bWindows NT\b/, "Windows"],
  [/\b(?:iPhone|iPad|iPod)\b/, "iOS"],
  [/\bAndroid\b/, "Android"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bMac OS X\b/, "macOS"],
  [/\bLinux\b/, "Linux"],
];

export function deviceLabel(userAgent: string | null): string | null {
  if (userAgent === null || userAgent.trim() === "") {
    return null;
  }

  const browser = browsers
    .map(([pattern, name]) => {
      const version = pattern.exec(userAgent)?.[1];

      return version === undefined ? null : `${name} ${version}`;
    })
    .find((value) => value !== null);
  const system = systems.find(([pattern]) => pattern.test(userAgent))?.[1];

  if (browser === undefined && system === undefined) {
    return null;
  }

  return [browser, system].filter(Boolean).join(", ");
}
