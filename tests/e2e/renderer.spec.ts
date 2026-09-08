import { expect, test } from "@playwright/test";

/** Default renderer path (WebGPU when available, else its WebGL2 backend): loads, edits, views, screenshots without page errors. */
test("default renderer: no page errors across presets and isometric", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByTestId("new-barn").first().click();
  await page.waitForURL(/\/new$/);
  await page.getByTestId("wizard-empty").click();
  await page.waitForURL(/\/p\/[^/]+/);
  await expect(page.getByTestId("viewer").locator("canvas")).toBeVisible();
  await page.waitForTimeout(1500);
  const renderer = await page.evaluate(() => (window as unknown as { __barnRenderer?: string }).__barnRenderer);
  expect(["webgpu", "webgl"]).toContain(renderer);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/renderer-exterior.png" });
  await page.getByTestId("rail-step-building").click();
  const width = page.getByTestId("input-width");
  await width.fill("30");
  await width.press("Enter");
  await page.getByTestId("view-menu").click();
  await page.getByTestId("view-framing").click();
  await page.getByTestId("iso-toggle").click();
  await page.keyboard.press("Escape");
  await page.getByTestId("view-menu").click();
  await page.getByTestId("view-noroof").click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "test-results/renderer.png" });
  expect(errors).toEqual([]);
});
