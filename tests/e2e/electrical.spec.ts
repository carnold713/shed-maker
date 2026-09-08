import { expect, goStep, test } from "./fixtures";

test("wizard builds a full barn; electrical step lights it, places devices and sizes the panel", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByTestId("new-barn").first().click();
  await page.waitForURL(/\/new$/);
  await page.getByTestId("wizard-species-horse").click();
  await page.getByTestId("wizard-count").fill("5");
  await expect(page.getByTestId("wizard-preview")).toContainText("5 horse stalls");
  await page.getByTestId("wizard-build").click();
  await page.waitForURL(/\/p\/[^/]+/);
  await expect(page.getByTestId("plan-zone-pen")).toHaveCount(5);
  await expect(page.getByTestId("plan-opening-slidingDoor")).toHaveCount(2);
  await expect(page.getByTestId("plan-opening-window")).toHaveCount(5);
  await expect(page.getByTestId("dock-title")).toContainText("Layout");

  // Electrical step: the wizard already lit and wired it; the summary and circuits show.
  await goStep(page, "electrical");
  await expect(page.getByTestId("load-summary")).toContainText("Demand");
  await expect(page.getByTestId("circuit-table")).toContainText("GFCI");
  await expect(page.getByTestId("plan-fixture-panel")).toHaveCount(1);
  const lights = await page.getByTestId("plan-fixture-light").count();
  expect(lights).toBeGreaterThanOrEqual(6);
  // The wizard's switch by the door shows dotted legs to the lights it controls; a light can be turned with R.
  expect(await page.getByTestId("plan-switch-leg").count()).toBeGreaterThanOrEqual(1);
  await page.getByTestId("plan-fixture-light").first().click();
  const rotation = page.getByTestId("fixture-rotation");
  const before = await rotation.inputValue();
  await page.getByTestId("fixture-rotate").click();
  expect(await rotation.inputValue()).not.toBe(before);
  await page.getByTestId("dock-back").click();

  // Place a heater with the tool: it snaps to a wall and gets its own 2-pole breaker.
  await page.getByTestId("tool-fixture").click();
  await page.getByTestId("fixture-picker").selectOption("heater");
  await page.getByTestId("plan-wall-e").click({ position: { x: 7, y: 120 } });
  await expect(page.getByTestId("plan-fixture-heater")).toHaveCount(1);
  await expect(page.getByTestId("dock-title")).toContainText("Unit heater");
  await page.getByTestId("dock-back").click();
  await expect(page.getByTestId("circuit-table")).toContainText("2-pole");

  // Remove a light with the Remove tool; the check step says which stall is now under-lit and can fix it.
  await page.getByTestId("tool-erase").click();
  await page.getByTestId("plan-fixture-light").first().click();
  await expect(page.getByTestId("plan-fixture-light")).toHaveCount(lights - 1);
  await page.keyboard.press("Escape");
  await goStep(page, "check");
  const fix = page.getByRole("button", { name: /^Light / }).first();
  await expect(fix).toBeVisible();
  await fix.click();
  await goStep(page, "electrical");
  await expect(page.getByTestId("plan-fixture-light")).toHaveCount(lights);

  // Plans step shows the estimate with an electrical line; autosave lands.
  await goStep(page, "plans");
  await expect(page.getByTestId("estimate-total")).toContainText("$");
  await expect(page.getByTestId("inspector-dock")).toContainText("Electrical");
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved", { timeout: 10_000 });
});
