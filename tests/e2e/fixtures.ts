import { test as base, expect, type Page } from "@playwright/test";

/**
 * Editor specs run on the WebGL renderer: headless Chromium has no real
 * WebGPU, and the WebGPU renderer's WebGL2 fallback is too slow under
 * software rendering for interaction-heavy specs. `renderer.spec.ts`
 * covers the default (WebGPU-first) path separately.
 */
export const test = base.extend({
  page: async ({ page }, run) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("barn.renderer", "webgl");
      } catch {
        /* ignore */
      }
    });
    await run(page);
  },
});
export { expect };

/** Home → New barn → "Start empty": the 24' × 36' default barn, landing on the Layout step. */
export async function newEmptyBarn(page: Page) {
  await page.goto("/");
  await page.getByTestId("new-barn").first().click();
  await page.waitForURL(/\/new$/);
  await page.getByTestId("wizard-empty").click();
  await page.waitForURL(/\/p\/[^/]+/);
  await expect(page.getByTestId("plan-svg")).toBeVisible();
}

export async function goStep(page: Page, step: string) {
  await page.getByTestId(`rail-step-${step}`).click();
}

/** Open the View menu and pick a 3D preset by its testid. */
export async function pickView(page: Page, id: "view-outside" | "view-inside" | "view-framing" | "view-noroof") {
  await page.getByTestId("view-menu").click();
  await page.getByTestId(id).click();
  await page.keyboard.press("Escape");
}
