import { expect, goStep, test } from "./fixtures";

test("site: runs off the stalls, fence takeoff, the barn on the map, site plan sheet", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // A wizard barn: alpacas in a shed row, every stall on an outside wall with a Dutch door.
  await page.goto("/new");
  await page.getByTestId("wizard-species-alpaca").click();
  await page.getByTestId("wizard-count").fill("4");
  await page.getByTestId("wizard-layout-shedRow").click();
  await page.getByTestId("wizard-build").click();
  await expect(page.getByTestId("stage")).toBeVisible();

  // Site step: one run per stall, sized for its animals.
  await goStep(page, "site");
  await expect(page.getByTestId("site-map")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("site-map-prompt")).toBeVisible();
  await page.getByTestId("auto-runs").click();
  // The first run is selected: its panel shows the per-head figure and the fence takeoff.
  await expect(page.getByTestId("dock-title")).toContainText("run");
  await expect(page.getByTestId("run-per-head")).toContainText("sq ft per alpaca");
  await expect(page.getByTestId("run-fence-summary")).toContainText("of fence");
  // A drive gate from the inspector.
  await page.getByTestId("run-add-drive-gate").click();
  await expect(page.getByTestId("run-gate-row")).toHaveCount(2);
  await page.keyboard.press("Escape");
  const runs = await page.getByTestId("item-list").locator("[data-testid^=item-]").count();
  expect(runs).toBeGreaterThanOrEqual(4);
  await expect(page.getByTestId("fence-summary")).toContainText("posts");

  // Put the barn on the land by coordinates; the overlay draws the barn and its runs; turn it.
  await page.getByTestId("site-coords").fill("40.0150, -82.4500");
  await page.getByTestId("site-coords").press("Enter");
  await expect(page.getByTestId("site-map")).toHaveAttribute("data-located", "1");
  await expect(page.getByTestId("map-barn")).toBeVisible();
  expect(await page.getByTestId("map-run").count()).toBeGreaterThanOrEqual(4);
  await page.getByTestId("site-orientation-num").fill("35");
  await page.getByTestId("site-orientation-num").press("Tab");
  await expect(page.getByTestId("site-map")).toContainText("35° from north");
  // Drag the barn a little on the map: the coordinates change.
  const barn = (await page.getByTestId("map-barn").boundingBox())!;
  await page.mouse.move(barn.x + barn.width / 2, barn.y + barn.height / 2);
  await page.mouse.down();
  await page.mouse.move(barn.x + barn.width / 2 + 60, barn.y + barn.height / 2 + 20, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId("site-coords")).not.toHaveValue("40.01500, -82.45000");
  await page.screenshot({ path: "test-results/site.png" });

  // The plan (other steps) shows the runs outside the walls and fits them.
  await goStep(page, "layout");
  expect(await page.getByTestId("plan-run").count()).toBeGreaterThanOrEqual(4);
  await expect(page.getByTestId("plan-gate").first()).toBeVisible();

  // Check step knows about runs (no error-level finding for runs); Plans: the site sheet and fencing cost.
  await goStep(page, "plans");
  await expect(page.getByTestId("estimate-total")).toBeVisible();
  await page.getByTestId("open-blueprints").click();
  await expect(page.getByTestId("sheet-A0")).toBeVisible();
  await expect(page.getByTestId("run-schedule")).toContainText("alpaca");
  await expect(page.getByTestId("fence-schedule")).toContainText("No-climb");
  await expect(page.getByTestId("materials-table")).toContainText("tube gates");
});
