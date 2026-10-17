import { describe, expect, it } from "vitest";
import { mapSerpapiShoppingResult } from "./serpapi";

const query = { region: "IN" as const, category: "top" };

const NEW_SHAPE_PDP =
  "https://www.snitch.com/men-shirts/regular-fit-black-shirt-4sfs145-02/9269896904866/buy";

describe("mapSerpapiShoppingResult", () => {
  it("drops Snitch splash URLs without a product handle", () => {
    expect(
      mapSerpapiShoppingResult(
        {
          title: "Snitch",
          link: "https://www.snitch.co.in/",
          thumbnail: "https://cdn.example/x.jpg",
        },
        query,
        0
      )
    ).toBeNull();
    expect(
      mapSerpapiShoppingResult(
        {
          title: "Snitch",
          link: "https://www.snitch.com/",
          thumbnail: "https://cdn.example/x.jpg",
        },
        query,
        1
      )
    ).toBeNull();
    expect(
      mapSerpapiShoppingResult(
        {
          title: "Snitch",
          link: "https://www.snitch.com/products",
          product_link: "https://www.snitch.co.in/",
          thumbnail: "https://cdn.example/x.jpg",
        },
        query,
        2
      )
    ).toBeNull();
  });

  it("drops Snitch .co.in PDP cards entirely — old handles cannot be mapped", () => {
    expect(
      mapSerpapiShoppingResult(
        {
          title: "Slim Fit Shirt",
          link: "https://www.snitch.co.in/products/slim-fit-shirt",
          product_link: "https://www.snitch.co.in/products/slim-fit-shirt",
          thumbnail: "https://cdn.example/shirt.jpg",
        },
        query,
        0
      )
    ).toBeNull();
  });

  it("drops dead /products/<handle> paths on snitch.com", () => {
    expect(
      mapSerpapiShoppingResult(
        {
          title: "Slim Fit Shirt",
          link: "https://www.snitch.com/products/slim-fit-shirt",
          thumbnail: "https://cdn.example/shirt.jpg",
        },
        query,
        0
      )
    ).toBeNull();
  });

  it("keeps live snitch.com PDPs of the /<category>/<handle>/<id>/buy shape", () => {
    const mapped = mapSerpapiShoppingResult(
      {
        title: "Regular Fit Black Shirt",
        link: NEW_SHAPE_PDP,
        product_link: NEW_SHAPE_PDP,
        thumbnail: "https://cdn.example/shirt.jpg",
      },
      query,
      0
    );
    expect(mapped).not.toBeNull();
    expect(mapped!.productUrl).toBe(NEW_SHAPE_PDP);
    expect(mapped!.canonicalUrl).toBe(NEW_SHAPE_PDP);
  });

  it("uses a usable product_link when link is a splash URL", () => {
    const mapped = mapSerpapiShoppingResult(
      {
        title: "Regular Fit Black Shirt",
        link: "https://www.snitch.com/",
        product_link: NEW_SHAPE_PDP,
        thumbnail: "https://cdn.example/shirt.jpg",
      },
      query,
      0
    );
    expect(mapped).not.toBeNull();
    expect(mapped!.productUrl).toBe(NEW_SHAPE_PDP);
    expect(mapped!.canonicalUrl).toBe(NEW_SHAPE_PDP);
  });
});
