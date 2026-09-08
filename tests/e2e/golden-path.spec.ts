import { expect, goStep, newEmptyBarn, test } from "./fixtures";

test("M0 golden path: create, edit, autosave, reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your barns" })).toBeVisible();
  await newEmptyBarn(page);
  const url = page.url();

  // Plan + 3D both render; the shell shows the steps, the status bar and the dock.
  await expect(page.getByTestId("viewer").locator("canvas")).toBeVisible();
  await expect(page.getByTestId("rail-step-layout")).toHaveAttribute("aria-current", "step");
  await expect(page.getByTestId("status-cost")).toContainText("$");
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved");

  // Edit width in the Building step; dirty -> saved within the 2s debounce.
  await goStep(page, "building");
  const width = page.getByTestId("input-width");
  await width.fill("30");
  await width.press("Enter");
  await expect(page.getByTestId("input-width")).toHaveValue("30'");
  await expect(page.getByTestId("status-facts")).toContainText("30' × 36'");
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved", { timeout: 10_000 });

  // Out-of-range values are refused with a reason.
  await width.fill("3");
  await width.press("Enter");
  await expect(page.getByTestId("input-width")).toHaveValue("30'");
  await expect(page.getByText(/Must be 4'/)).toBeVisible();

  // Undo via keyboard, then redo.
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("input-width")).toHaveValue("24'");
  await page.keyboard.press("Control+Shift+z");
  await expect(page.getByTestId("input-width")).toHaveValue("30'");
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved", { timeout: 10_000 });

  await page.screenshot({ path: "test-results/editor.png" });

  // Reload: the draft persisted.
  await page.goto(url);
  await goStep(page, "building");
  await expect(page.getByTestId("input-width")).toHaveValue("30'");

  // Home lists the project with its footprint.
  await page.goto("/");
  await expect(page.getByText("30×36")).toBeVisible();
});
