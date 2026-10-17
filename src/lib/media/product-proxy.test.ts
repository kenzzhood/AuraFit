import { describe, expect, it } from "vitest";
import { UnsafeUrlError } from "@/lib/security/ssrf";
import { assertProductProxyUrl } from "./product-proxy";

describe("assertProductProxyUrl", () => {
  it("allows public https URLs", () => {
    const url = assertProductProxyUrl(
      "https://assets.myntra.com/assets/images/123/product.jpg"
    );
    expect(url.hostname).toBe("assets.myntra.com");
    expect(url.protocol).toBe("https:");
  });

  it("throws on localhost", () => {
    expect(() => assertProductProxyUrl("http://localhost/secret.jpg")).toThrow(
      UnsafeUrlError
    );
  });

  it("throws on 127.0.0.1", () => {
    expect(() => assertProductProxyUrl("http://127.0.0.1/img.jpg")).toThrow(
      UnsafeUrlError
    );
  });

  it("throws on 10.x private hosts", () => {
    expect(() => assertProductProxyUrl("http://10.0.0.8/img.jpg")).toThrow(
      UnsafeUrlError
    );
    expect(() => assertProductProxyUrl("http://10.1.2.3/img.png")).toThrow(
      UnsafeUrlError
    );
  });

  it("throws on cloud metadata 169.254.169.254", () => {
    expect(() =>
      assertProductProxyUrl("http://169.254.169.254/latest/meta-data/")
    ).toThrow(UnsafeUrlError);
  });

  it("throws on file: URLs", () => {
    expect(() => assertProductProxyUrl("file:///etc/passwd")).toThrow(
      UnsafeUrlError
    );
  });
});
