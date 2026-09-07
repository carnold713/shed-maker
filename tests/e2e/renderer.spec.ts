import { expect, test } from "@playwright/test";

/** Default renderer path (WebGPU when available, else its WebGL2 backend): loads, edits, views, screenshots without page errors. */
test("default renderer: no page errors across presets, cutaway and isometric", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "New barn" }).first().click();
  await page.waitForURL(/\/p\/[^/]+$/);
  await expect(page.getByTestId("viewer").locator("canvas")).toBeVisible();
  await page.waitForTimeout(1500);
  const renderer = await page.evaluate(() => (window as unknown as { __barnRenderer?: string }).__barnRenderer);
  expect(["webgpu", "webgl"]).toContain(renderer);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/renderer-exterior.png" });
  const width = page.getByTestId("input-width");
  await width.fill("30");
  await width.press("Enter");
  await page.getByRole("button", { name: "Framing" }).click();
  await page.getByTestId("cut-toggle").check();
  await page.getByTestId("iso-toggle").click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "test-results/renderer.png" });
  expect(errors).toEqual([]);
});
