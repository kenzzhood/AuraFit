import { describe, expect, it } from "vitest";
import {
  UnsafeUrlError,
  assertAllowedUserMediaUrl,
  assertSafeExternalUrl,
} from "./ssrf";

describe("assertSafeExternalUrl", () => {
  it("allows public https URLs", () => {
    const url = assertSafeExternalUrl("https://example.com/image.jpg");
    expect(url.hostname).toBe("example.com");
  });

  it("blocks localhost", () => {
    expect(() => assertSafeExternalUrl("http://localhost/admin")).toThrow(
      UnsafeUrlError
    );
  });

  it("blocks private IPv4 ranges", () => {
    expect(() => assertSafeExternalUrl("http://10.0.0.1/")).toThrow(
      UnsafeUrlError
    );
    expect(() => assertSafeExternalUrl("http://192.168.1.1/")).toThrow(
      UnsafeUrlError
    );
    expect(() => assertSafeExternalUrl("http://127.0.0.1/")).toThrow(
      UnsafeUrlError
    );
  });

  it("blocks cloud metadata endpoint", () => {
    expect(() =>
      assertSafeExternalUrl("http://169.254.169.254/latest/meta-data/")
    ).toThrow(UnsafeUrlError);
  });

  it("blocks IPv4-mapped IPv6 loopback", () => {
    expect(() =>
      assertSafeExternalUrl("http://[::ffff:127.0.0.1]/")
    ).toThrow(UnsafeUrlError);
  });

  it("blocks non-http(s) protocols", () => {
    expect(() => assertSafeExternalUrl("file:///etc/passwd")).toThrow(
      UnsafeUrlError
    );
  });

  it("enforces host allowlist when provided", () => {
    assertSafeExternalUrl("https://cdn.example.com/x.jpg", {
      allowedHosts: ["cdn.example.com"],
    });
    expect(() =>
      assertSafeExternalUrl("https://evil.com/x.jpg", {
        allowedHosts: ["cdn.example.com"],
      })
    ).toThrow(UnsafeUrlError);
  });
});

describe("assertAllowedUserMediaUrl", () => {
  it("allows configured storage hosts", () => {
    const url = assertAllowedUserMediaUrl(
      "https://res.cloudinary.com/demo/image/upload/v1/a.jpg"
    );
    expect(url.hostname).toBe("res.cloudinary.com");
  });

  it("rejects arbitrary external hosts", () => {
    expect(() =>
      assertAllowedUserMediaUrl("https://attacker.example/steal.jpg")
    ).toThrow(UnsafeUrlError);
  });
});
