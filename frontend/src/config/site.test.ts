import { describe, expect, it } from "vitest";
import { parseApiOrigin, resolveInquiryApiUrl } from "./site";

describe("parseApiOrigin", () => {
  it("accepts an HTTPS origin, with or without a trailing slash", () => {
    expect(parseApiOrigin("https://api.example.test")).toBe("https://api.example.test");
    expect(parseApiOrigin("  https://api.example.test/  ")).toBe("https://api.example.test");
    expect(parseApiOrigin("https://api.example.test:8443")).toBe("https://api.example.test:8443");
  });

  it("allows plain HTTP only on an explicit loopback host", () => {
    expect(parseApiOrigin("http://localhost:8000")).toBe("http://localhost:8000");
    expect(parseApiOrigin("http://127.0.0.1:8000")).toBe("http://127.0.0.1:8000");
    expect(parseApiOrigin("http://[::1]:8000")).toBe("http://[::1]:8000");
    expect(parseApiOrigin("http://api.example.test")).toBeNull();
    expect(parseApiOrigin("http://localhost.example.test")).toBeNull();
  });

  it("rejects anything that is not a bare origin", () => {
    for (const value of [
      undefined,
      "",
      "   ",
      "api.example.test",
      "//api.example.test",
      "ftp://api.example.test",
      "javascript:alert(1)",
      "https://user:secret@api.example.test",
      "https://token@api.example.test",
      "https://api.example.test/api",
      "https://api.example.test/api/v1/inquiries",
      "https://api.example.test?x=1",
      "https://api.example.test#x",
      "https://api.example.test\\evil",
      "https://",
    ])
      expect(parseApiOrigin(value), String(value)).toBeNull();
  });
});

describe("resolveInquiryApiUrl", () => {
  it("is off by default and when only one half is configured", () => {
    expect(resolveInquiryApiUrl(undefined, undefined)).toBeNull();
    expect(resolveInquiryApiUrl("", "https://api.example.test")).toBeNull();
    expect(resolveInquiryApiUrl("false", "https://api.example.test")).toBeNull();
    expect(resolveInquiryApiUrl("true", undefined)).toBeNull();
    expect(resolveInquiryApiUrl("true", "")).toBeNull();
  });

  it("needs the flag to be exactly true", () => {
    for (const flag of ["1", "yes", "TRUE", "True", "on"])
      expect(resolveInquiryApiUrl(flag, "https://api.example.test"), flag).toBeNull();
  });

  it("stays off when the origin is invalid", () => {
    expect(resolveInquiryApiUrl("true", "http://api.example.test")).toBeNull();
    expect(resolveInquiryApiUrl("true", "https://api.example.test/v1")).toBeNull();
  });

  it("builds exactly /api/v1/inquiries on the configured origin", () => {
    expect(resolveInquiryApiUrl("true", "https://api.example.test/")).toBe(
      "https://api.example.test/api/v1/inquiries",
    );
    expect(resolveInquiryApiUrl(" true ", "http://localhost:8000")).toBe(
      "http://localhost:8000/api/v1/inquiries",
    );
  });
});
