import { describe, expect, it } from "vitest";
import { readSignInNotice, safeReturnTo, signInPath } from "./return-to";

describe("safeReturnTo", () => {
  it.each(["/", "/akun", "/akun/keamanan"])("accepts the private screen %s", (path) => {
    expect(safeReturnTo(path)).toBe(path);
  });

  it("drops query and fragment", () => {
    expect(safeReturnTo("/akun?x=1#y")).toBe("/akun");
  });

  it.each([
    null,
    undefined,
    "",
    "akun",
    "//evil.example/akun",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "https://evil.example/akun",
    "javascript:alert(1)",
    "/%2F%2Fevil.example",
    "/akun/../access",
    "/access",
    "/masuk",
    "/users",
    "/akun\u0000",
    "/akun\n//evil.example",
    "/referensi-komponen",
  ])("refuses %j and falls back to home", (value) => {
    expect(safeReturnTo(value)).toBe("/");
  });
});

describe("signInPath", () => {
  it("writes a validated return path and a fixed notice word", () => {
    expect(signInPath()).toBe("/masuk");
    expect(signInPath({ returnTo: "/akun/keamanan", notice: "expired" })).toBe(
      "/masuk?kembali=%2Fakun%2Fkeamanan&alasan=berakhir",
    );
    expect(signInPath({ returnTo: "//evil.example", notice: "signed-out" })).toBe(
      "/masuk?alasan=keluar",
    );
  });

  it("reads only the notice words it writes", () => {
    expect(readSignInNotice("berakhir")).toBe("expired");
    expect(readSignInNotice("tempat-lain")).toBe("elsewhere");
    expect(readSignInNotice("<b>")).toBeNull();
    expect(readSignInNotice(null)).toBeNull();
  });
});
