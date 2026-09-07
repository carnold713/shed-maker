import { test as base } from "@playwright/test";

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
export { expect } from "@playwright/test";
