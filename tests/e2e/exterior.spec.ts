import { expect, test } from "./fixtures";

test("exterior tools: door and window palettes, lean-to, concrete pad", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 860 });
  await page.goto("/");
  await page.getByRole("button", { name: "New barn" }).first().click();
  await page.waitForURL(/\/p\/[^/]+$/);
  await expect(page.getByTestId("plan-svg")).toBeVisible();

  // Door tool: pick a roll-up door and click the east wall.
  await page.getByTestId("tool-door").click();
  await expect(page.getByTestId("door-picker")).toBeVisible();
  await page.getByTestId("door-ru10").click();
  await page.getByTestId("plan-wall-e").click({ position: { x: 7, y: 300 } });
  await expect(page.getByTestId("plan-opening-rollUpDoor")).toHaveCount(1);
  await expect(page.getByTestId("opening-width")).toHaveValue("10'");

  // Window tool: 4×6 fixed on the south wall.
  await page.getByTestId("tool-window").click();
  await page.getByTestId("window-w46").click();
  await page.getByTestId("plan-wall-s").click({ position: { x: 60, y: 7 } });
  await expect(page.getByTestId("plan-opening-window")).toHaveCount(1);
  await expect(page.getByTestId("opening-height")).toHaveValue("6'");

  // Lean-to tool on the west wall, then edit depth and enclose it.
  await page.getByTestId("tool-leanto").click();
  await page.getByTestId("plan-wall-w").click({ position: { x: 7, y: 200 } });
  await expect(page.getByTestId("plan-leanto-w")).toHaveCount(1);
  await page.getByTestId("leanto-depth").selectOption("10");
  await page.getByTestId("leanto-enclosed").check();
  await expect(page.getByTestId("plan-leanto-w")).toContainText("Enclosed lean-to 10'");

  // Check panel flags the low outer edge and offers to raise the eave; apply it.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Raise eave to/ }).first().click();
  await expect(page.getByTestId("input-eave")).toHaveValue("12'");

  // Foundation panel: aprons toggle; add a south lean-to from the panel.
  await expect(page.getByTestId("slab-aprons")).toBeChecked();
  await page.getByTestId("add-leanto-s").click();
  await expect(page.getByTestId("plan-leanto-s")).toHaveCount(1);
  await page.getByTestId("leanto-delete").click();
  await expect(page.getByTestId("plan-leanto-s")).toHaveCount(0);

  // 3D exterior with the pad and awning; autosave; reload keeps everything.
  await page.getByRole("button", { name: "3D" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/exterior.png" });
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved", { timeout: 10_000 });
  await page.reload();
  await page.getByRole("button", { name: "Split" }).click();
  await expect(page.getByTestId("plan-leanto-w")).toHaveCount(1);
  await expect(page.getByTestId("plan-opening-rollUpDoor")).toHaveCount(1);
});
