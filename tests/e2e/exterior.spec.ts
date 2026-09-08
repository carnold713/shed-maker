import { expect, goStep, newEmptyBarn, test } from "./fixtures";

test("outside step: door and window pickers, lean-to, concrete pad, check fixes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await newEmptyBarn(page);
  await goStep(page, "outside");
  await expect(page.getByTestId("empty-state")).toContainText("No doors yet");

  // Door tool: pick a roll-up door and click the east wall. One placement returns to Select with the door selected.
  await page.getByTestId("tool-door").click();
  await page.getByTestId("door-picker").selectOption("ru10");
  await expect(page.getByTestId("status-hint")).toContainText("roll-up door");
  await page.getByTestId("plan-wall-e").click({ position: { x: 7, y: 150 } });
  await expect(page.getByTestId("plan-opening-rollUpDoor")).toHaveCount(1);
  await expect(page.getByTestId("opening-width")).toHaveValue("10'");
  await expect(page.getByTestId("dock-title")).toContainText("Roll-up door");
  await page.getByTestId("dock-back").click();

  // Window tool: 4×6 fixed on the south wall.
  await page.getByTestId("tool-window").click();
  await page.getByTestId("window-picker").selectOption("w46");
  await page.getByTestId("plan-wall-s").click({ position: { x: 60, y: 7 } });
  await expect(page.getByTestId("plan-opening-window")).toHaveCount(1);
  await expect(page.getByTestId("opening-height")).toHaveValue("6'");
  await page.getByTestId("dock-back").click();

  // Lean-to tool on the west wall, then edit depth and enclose it.
  await page.getByTestId("tool-leanto").click();
  await page.getByTestId("plan-wall-w").click({ position: { x: 7, y: 200 } });
  await expect(page.getByTestId("plan-leanto-w")).toHaveCount(1);
  await page.getByTestId("leanto-depth").selectOption("10");
  await page.getByTestId("leanto-enclosed").check();
  await expect(page.getByTestId("plan-leanto-w")).toContainText("Enclosed lean-to 10'");
  await page.getByTestId("dock-back").click();

  // The Outside panel lists what was added, by wall.
  await expect(page.getByTestId("inspector-dock")).toContainText("Roll-up door");

  // Check step flags the low outer edge and offers to raise the wall; apply it.
  await goStep(page, "check");
  await page.getByRole("button", { name: /Raise eave to/ }).first().click();
  await goStep(page, "building");
  await expect(page.getByTestId("input-eave")).toHaveValue("12'");
  await expect(page.getByTestId("slab-aprons")).toBeChecked();

  // Add a south lean-to from the Outside panel, then delete it from its panel.
  await goStep(page, "outside");
  await page.getByTestId("add-leanto-s").click();
  await expect(page.getByTestId("plan-leanto-s")).toHaveCount(1);
  await page.getByTestId("leanto-delete").click();
  await expect(page.getByTestId("plan-leanto-s")).toHaveCount(0);

  // 3D only, screenshot, autosave; reload keeps everything.
  await page.getByTestId("stage-3d").click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/exterior.png" });
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved", { timeout: 10_000 });
  await page.reload();
  await page.getByTestId("stage-both").click();
  await expect(page.getByTestId("plan-leanto-w")).toHaveCount(1);
  await expect(page.getByTestId("plan-opening-rollUpDoor")).toHaveCount(1);
});
