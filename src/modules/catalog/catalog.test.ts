import { describe, expect, it } from "vitest";
import { departmentCoverage, parseCatalogueCsv, photoQualityGate } from "./index";

describe("catalogue intake", () => {
  it("parses the canonical file and rejects a bad barcode", () => {
    const parsed = parseCatalogueCsv(
      [
        "style,variant,barcode,price,size,colour,stock,location",
        "silk-saree,maroon-m,8901234567890,12999,M,maroon,2,Floor 1 · Ethnic · Rack W3",
        "bad,bad,ABC,10,S,red,1,Rack A",
      ].join("\n")
    );
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].style).toBe("silk-saree");
    expect(parsed.rows[0].variant).not.toBe(parsed.rows[0].style);
    expect(parsed.errors).toHaveLength(1);
  });

  it("holds go-live until the department is covered and photos pass", () => {
    expect(departmentCoverage(96, 100).goLive).toBe(true);
    expect(departmentCoverage(90, 100).goLive).toBe(false);
    expect(photoQualityGate(0.5)).toBe("reshoot");
  });
});
