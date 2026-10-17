import { describe, expect, it } from "vitest";
import { byteCount, characterCount, newPasswordProblem, normaliseTotp } from "./password-policy";

describe("new password rule (12 characters, 72 bytes)", () => {
  it("counts characters as Laravel does and bytes as bcrypt does", () => {
    expect(characterCount("é".repeat(12))).toBe(12);
    expect(byteCount("é".repeat(12))).toBe(24);
    expect(characterCount("😀")).toBe(1);
  });

  it.each([
    ["eleven chars", "eleven char", "too-short"],
    ["twelve chars", "twelve chars", null],
    ["72 ASCII bytes", "x".repeat(72), null],
    ["73 ASCII bytes", "x".repeat(73), "too-long"],
    ["36 two-byte letters", "é".repeat(36), null],
    ["37 two-byte letters", "é".repeat(37), "too-long"],
  ])("%s", (_, password, problem) => {
    expect(newPasswordProblem(password, password)).toBe(problem);
  });

  it("asks for an identical confirmation", () => {
    expect(newPasswordProblem("a long passphrase", "a long passphrasE")).toBe("mismatch");
  });
});

describe("normaliseTotp", () => {
  it.each([
    ["123456", "123456"],
    ["123 456", "123456"],
    [" 123-456 ", "123456"],
    ["12345", null],
    ["1234567", null],
    ["abcdef", null],
  ])("%j", (input, output) => {
    expect(normaliseTotp(input)).toBe(output);
  });
});
