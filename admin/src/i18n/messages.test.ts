import { describe, expect, it } from "vitest";
import { referenceCopy } from "~/pages/component-reference-copy";
import { en } from "./messages/en";
import { id } from "./messages/id";

/** Every string value in a catalogue, with its key path (functions are called with samples). */
function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") {
    return [[path, value]];
  }

  if (typeof value === "function") {
    return [
      [path, String((value as (...args: unknown[]) => unknown)(403, "http://127.0.0.1:5174"))],
    ];
  }

  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      strings(child, path ? `${path}.${key}` : key),
    );
  }

  return [];
}

const catalogues = { id, en, referenceId: referenceCopy.id, referenceEn: referenceCopy.en };

describe("interface copy", () => {
  it("has the same keys in both languages", () => {
    const keys = (value: unknown) => strings(value).map(([path]) => path);

    expect(keys(en)).toEqual(keys(id));
    expect(keys(referenceCopy.en)).toEqual(keys(referenceCopy.id));
  });

  it.each(Object.entries(catalogues))(
    "%s has no empty strings and no em dashes",
    (_, catalogue) => {
      for (const [path, text] of strings(catalogue)) {
        expect(text.trim(), path).not.toBe("");
        expect(text, path).not.toMatch(/[—]/);
      }
    },
  );

  it("never claims sign-in or administration exists", () => {
    const all = strings(id)
      .map(([, text]) => text)
      .join("\n");

    expect(all).not.toMatch(/berhasil masuk|selamat datang kembali|dasbor siap/i);
  });
});
