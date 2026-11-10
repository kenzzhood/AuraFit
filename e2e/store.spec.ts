import { expect, test } from "@playwright/test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const pages = [
  "/",
  "/kiosk",
  "/kiosk/phone",
  "/staff",
  "/owner",
  "/owner/heatmap",
  "/admin",
  "/admin/catalogue",
  "/admin/renders",
  "/whatsapp",
  "/s/anna-nagar/blue-kurta",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name === "page.tsx") out.push(path);
  }
  return out;
}

test("every page file has a route in the suite", () => {
  const files = walk("src/app");
  expect(files.length).toBe(pages.length);
});

for (const path of pages) {
  test(`${path} returns 200 without a Next error`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    const portal = page.locator("nextjs-portal");
    if ((await portal.count()) > 0) {
      await expect(portal).not.toContainText(/Application error|Unhandled Runtime Error/);
    }
    const noisy = errors.filter(
      (line) => !line.includes("favicon") && !line.includes("Failed to load resource") && !line.includes("hmr")
    );
    expect(noisy).toEqual([]);
  });
}

test("kiosk walks six looks, a try-on, and a WhatsApp code", async ({ page }) => {
  await page.goto("/kiosk");
  await page.getByRole("button", { name: "I'm on the footprints" }).click();
  await page.getByRole("button", { name: "Raise your hand" }).click();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByRole("button", { name: "Me, women's" }).click();
  await page.getByRole("button", { name: "Office" }).click();
  await page.getByRole("button", { name: "₹1,000–2,500" }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: "No photo. I'll pick a model" }).click();
  await page.getByRole("button", { name: "Model B" }).click();
  const looks = page.locator(".tile img");
  await expect(looks).toHaveCount(6);
  await page.locator(".tile").first().click();
  await page.getByRole("button", { name: /See it on/ }).click();
  await expect(page.getByRole("button", { name: "Save to phone" })).toBeVisible();
  await page.getByRole("button", { name: "Save to phone" }).click();
  await expect(page.getByText(/AF-/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open WhatsApp" })).toBeVisible();
});

test("staff, owner, heatmap, catalogue, and a product page", async ({ page }) => {
  await page.goto("/staff");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Calls on the floor" })).toBeVisible();

  await page.goto("/owner");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Tried, not bought" })).toBeVisible();

  await page.goto("/owner/heatmap");
  await expect(page.getByText("entrance")).toBeVisible();

  await page.goto("/admin/catalogue");
  await page.getByRole("button", { name: "Continue as admin" }).click();
  await expect(page.getByRole("heading", { name: "Catalogue" })).toBeVisible();
  await page.getByRole("button", { name: "Ask staff" }).first().click();
  await expect(page.getByText(/is now ask staff/)).toBeVisible();

  await page.goto("/s/anna-nagar/missing-saree");
  await expect(page.getByRole("link", { name: "Order on WhatsApp" })).toBeVisible();
  await expect(page.getByText("Ask staff")).toBeVisible();
});

const shots: [string, number, number][] = [
  ["/kiosk", 1920, 1080],
  ["/kiosk", 1440, 900],
  ["/kiosk", 390, 844],
  ["/owner/heatmap", 1440, 900],
  ["/s/anna-nagar/blue-kurta", 390, 844],
];

for (const [path, width, height] of shots) {
  test(`screenshot ${path} at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(path);
    await page.screenshot({
      path: `artifacts/playwright/${path.split("/").join("_") || "home"}-${width}x${height}.png`,
      fullPage: true,
    });
  });
}
