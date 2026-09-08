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

  // Plan navigation: zoom buttons, fit, and a draggable split.
  await expect(page.getByTestId("plan-wrap")).toHaveAttribute("data-zoom", "100");
  await page.getByTestId("plan-zoom-in").click();
  await expect(page.getByTestId("plan-wrap")).toHaveAttribute("data-zoom", "125");
  await page.getByTestId("plan-fit").click();
  await expect(page.getByTestId("plan-wrap")).toHaveAttribute("data-zoom", "100");
  const divider = page.getByTestId("stage-divider");
  const before = Number(await page.getByTestId("stage").getAttribute("data-plan-pct"));
  const db = (await divider.boundingBox())!;
  await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2);
  await page.mouse.down();
  await page.mouse.move(db.x + db.width / 2 + 160, db.y + db.height / 2, { steps: 8 });
  await page.mouse.up();
  const after = Number(await page.getByTestId("stage").getAttribute("data-plan-pct"));
  expect(after).toBeGreaterThan(before + 5);
  await divider.dblclick();
  await expect(page.getByTestId("stage")).toHaveAttribute("data-plan-pct", String(before));

  await page.screenshot({ path: "test-results/editor.png" });

  // Reload: the draft persisted.
  await page.goto(url);
  await goStep(page, "building");
  await expect(page.getByTestId("input-width")).toHaveValue("30'");

  // Home lists the project with its footprint.
  await page.goto("/");
  await expect(page.getByText("30×36")).toBeVisible();
});
