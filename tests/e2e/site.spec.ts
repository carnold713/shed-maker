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
  await expect(page.getByTestId("site-surface-plan")).toBeVisible(); // the plan until the barn has a location
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

  // Fence tool on the plan: four corners, back to the first one closes a paddock; gate; takeoff.
  await page.getByTestId("site-surface-plan").click();
  await page.getByTestId("tool-fence").click();
  const plan = page.getByTestId("plan-svg");
  const pb = (await plan.boundingBox())!;
  const corners: [number, number][] = [[0.06, 0.08], [0.3, 0.08], [0.3, 0.4], [0.06, 0.4]];
  for (const [fx, fy] of corners) await page.mouse.click(pb.x + pb.width * fx, pb.y + pb.height * fy);
  await expect(page.getByTestId("fence-draft")).toBeVisible();
  await page.mouse.click(pb.x + pb.width * corners[0][0], pb.y + pb.height * corners[0][1]); // close it
  await expect(page.getByTestId("plan-fence")).toHaveCount(1);
  await expect(page.getByTestId("dock-title")).toContainText("Paddock 1");
  await expect(page.getByTestId("fence-summary")).toContainText("around");
  await page.getByTestId("fence-add-drive-gate").click();
  await expect(page.getByTestId("fence-gate-row")).toHaveCount(1);
  await expect(page.getByTestId("plan-fence-gate")).toHaveCount(1);
  await page.keyboard.press("Escape"); // fence tool -> select
  await page.keyboard.press("Escape"); // clear the selection -> Site panel
  await expect(page.getByTestId("fence-summary")).toContainText("posts");
  await page.getByTestId("site-surface-map").click();
  await expect(page.getByTestId("site-map")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("site-map-prompt")).toBeVisible();

  // Put the barn on the land by coordinates; the overlay draws the barn and its runs; turn it.
  await page.getByTestId("site-coords").fill("40.0150, -82.4500");
  await page.getByTestId("site-coords").press("Enter");
  await expect(page.getByTestId("site-map")).toHaveAttribute("data-located", "1");
  await expect(page.getByTestId("map-barn")).toBeVisible();
  expect(await page.getByTestId("map-run").count()).toBeGreaterThanOrEqual(4);
  await expect(page.getByTestId("map-fence")).toHaveCount(1);
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
  // Right-click anywhere on the map drops the barn there; "Put the barn here" then a click does too.
  const mapBox = (await page.getByTestId("site-map").boundingBox())!;
  const before = await page.getByTestId("site-coords").inputValue();
  await page.mouse.click(mapBox.x + 120, mapBox.y + mapBox.height - 120, { button: "right" });
  await expect(page.getByTestId("site-coords")).not.toHaveValue(before);
  await page.getByTestId("map-place-barn").click();
  await expect(page.getByTestId("site-map-placing")).toBeVisible();
  const mid = await page.getByTestId("site-coords").inputValue();
  await page.mouse.click(mapBox.x + mapBox.width - 150, mapBox.y + 150);
  await expect(page.getByTestId("site-coords")).not.toHaveValue(mid);
  await expect(page.getByTestId("site-map-placing")).toHaveCount(0);
  // Draw a fence line straight on the map: three clicks, double-click to finish an open line.
  await page.getByTestId("tool-fence").click();
  await page.mouse.click(mapBox.x + 80, mapBox.y + 80);
  await page.mouse.click(mapBox.x + 200, mapBox.y + 80);
  await page.mouse.click(mapBox.x + 200, mapBox.y + 220);
  await expect(page.getByTestId("map-fence-draft")).toBeVisible();
  await page.mouse.dblclick(mapBox.x + 320, mapBox.y + 220);
  await expect(page.getByTestId("map-fence")).toHaveCount(2);
  await expect(page.getByTestId("dock-title")).toContainText("Fence line 2");
  await page.keyboard.press("Escape");
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
  await expect(page.getByTestId("fence-lines")).toContainText("Paddock 1");
  await expect(page.getByTestId("sheet-fence")).toHaveCount(2);
  await expect(page.getByTestId("fence-schedule")).toContainText("No-climb");
  await expect(page.getByTestId("materials-table")).toContainText("tube gates");
});
