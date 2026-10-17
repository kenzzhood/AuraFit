import { describe, expect, it } from "vitest";
import { displayProductImageSrc } from "./display-product-image";

describe("displayProductImageSrc", () => {
  it("returns undefined for empty or invalid values", () => {
    expect(displayProductImageSrc(undefined)).toBeUndefined();
    expect(displayProductImageSrc("")).toBeUndefined();
    expect(displayProductImageSrc("   ")).toBeUndefined();
    expect(displayProductImageSrc("not a url")).toBeUndefined();
  });

  it("passes through blob, data, and relative URLs", () => {
    expect(displayProductImageSrc("blob:https://aurafit.local/abc")).toBe(
      "blob:https://aurafit.local/abc"
    );
    expect(displayProductImageSrc("data:image/png;base64,abc")).toBe(
      "data:image/png;base64,abc"
    );
    expect(displayProductImageSrc("/uploads/look.jpg")).toBe("/uploads/look.jpg");
  });

  it("passes through first-party and known CDN hosts", () => {
    expect(
      displayProductImageSrc("https://res.cloudinary.com/demo/image/upload/a.jpg")
    ).toBe("https://res.cloudinary.com/demo/image/upload/a.jpg");
    expect(
      displayProductImageSrc(
        "https://mystorage.blob.core.windows.net/wardrobes/a.jpg"
      )
    ).toBe("https://mystorage.blob.core.windows.net/wardrobes/a.jpg");
    expect(
      displayProductImageSrc("https://cdn.azureedge.net/looks/a.jpg")
    ).toBe("https://cdn.azureedge.net/looks/a.jpg");
    expect(displayProductImageSrc("https://img.clerk.com/user.png")).toBe(
      "https://img.clerk.com/user.png"
    );
    expect(
      displayProductImageSrc("https://images.unsplash.com/photo-1")
    ).toBe("https://images.unsplash.com/photo-1");
  });

  it("proxies arbitrary public https product URLs", () => {
    const raw = "https://assets.myntra.com/assets/images/123/product.jpg";
    expect(displayProductImageSrc(raw)).toBe(
      `/api/media/product?url=${encodeURIComponent(raw)}`
    );
  });
});
