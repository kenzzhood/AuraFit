import { describe, expect, it } from "vitest";
import { openDatabase, readStyles, rememberStyle } from "./client";

describe("store database", () => {
  it("migrates and keeps a style availability", async () => {
    const db = await openDatabase(":memory:");
    await rememberStyle(db, "blue-kurta", "ask_staff");
    const rows = await readStyles(db);
    expect(rows).toEqual([{ id: "blue-kurta", availability: "ask_staff" }]);
  });
});
