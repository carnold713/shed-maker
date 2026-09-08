import { expect, goStep, newEmptyBarn, test } from "./fixtures";

test("drains: a wash bay gets a trench drain and an outlet; the P1 sheet shows the slope and pipe", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await newEmptyBarn(page);
  // Layout: stamp a wash bay.
  await page.getByTestId("tool-room").click();
  await page.getByTestId("room-picker").selectOption("wash");
  const plan = page.getByTestId("plan-svg");
  const box = (await plan.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.75);
  await expect(page.getByTestId("plan-zone-wash")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // Building step: the wash bay is flagged; one click drains it and places the outlet.
  await goStep(page, "building");
  await expect(page.getByTestId("empty-state")).toContainText("No drains yet");
  await page.getByTestId("auto-drain").click();
  await expect(page.getByTestId("plan-drain-trench")).toHaveCount(1);
  await expect(page.getByTestId("plan-drain-outlet")).toHaveCount(1);
  await expect(page.getByTestId("drain-summary")).toContainText("pipe");

  // Add a floor drain with the tool, then open its panel.
  await page.getByTestId("tool-drain-floor").click();
  await expect(page.getByTestId("status-hint")).toContainText("floor drain");
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.35);
  await expect(page.getByTestId("plan-drain-floor")).toHaveCount(1);
  await expect(page.getByTestId("dock-title")).toContainText("drain");
  await expect(page.getByTestId("inspector-dock")).toContainText("Slab slopes");
  await page.getByTestId("dock-back").click();

  // Outlet panel: switch it to a dry well.
  await page.getByTestId("plan-drain-outlet").click();
  await page.getByTestId("outlet-kind").selectOption("dryWell");
  await page.getByTestId("dock-back").click();

  // The pack has a P1 sheet with the schedule and the crew notes.
  await goStep(page, "plans");
  await page.getByTestId("open-blueprints").click();
  await page.waitForURL(/\/pack$/);
  await expect(page.getByTestId("sheet-P1")).toBeVisible();
  await expect(page.getByTestId("drain-schedule")).toContainText("Trench");
  await expect(page.getByTestId("sheet-P1")).toContainText("Dry well");
  await expect(page.getByTestId("materials-table")).toContainText("Trench drain");
});
