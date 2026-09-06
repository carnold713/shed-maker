import { expect, test } from "@playwright/test";

test("M0 golden path: create, edit, autosave, reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your barns" })).toBeVisible();

  await page.getByRole("button", { name: "New barn" }).first().click();
  await page.waitForURL(/\/p\/[^/]+$/);
  const url = page.url();

  // Plan + 3D both render.
  await expect(page.getByTestId("plan-svg")).toBeVisible();
  await expect(page.getByTestId("viewer").locator("canvas")).toBeVisible();
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved");

  // Edit width via the inspector; dirty -> saved within the 2s debounce.
  const width = page.getByTestId("input-width");
  await width.fill("30");
  await width.press("Enter");
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "dirty");
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved", { timeout: 10_000 });
  await expect(page.getByTestId("input-width")).toHaveValue("30'");

  // Undo via keyboard, then redo.
  await page.locator("body").click();
  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("input-width")).toHaveValue("24'");
  await page.keyboard.press("Control+Shift+z");
  await expect(page.getByTestId("input-width")).toHaveValue("30'");
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved", { timeout: 10_000 });

  await page.screenshot({ path: "test-results/editor.png" });

  // Reload: the draft persisted.
  await page.goto(url);
  await expect(page.getByTestId("input-width")).toHaveValue("30'");

  // Home lists the project with its footprint.
  await page.goto("/");
  await expect(page.getByText("30×36")).toBeVisible();

});
