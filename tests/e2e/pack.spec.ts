import { expect, goStep, test } from "./fixtures";

test("blueprint pack: every sheet renders from a wizard barn with schedules, cut list, hardware and sequence", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByTestId("new-barn").first().click();
  await page.waitForURL(/\/new$/);
  await page.getByTestId("wizard-build").click();
  await page.waitForURL(/\/p\/[^/]+/);
  await expect(page.getByTestId("plan-zone-pen")).toHaveCount(4);
  await goStep(page, "plans");
  await expect(page.getByTestId("estimate-total")).toContainText("$");
  await page.getByTestId("open-blueprints").click();
  await page.waitForURL(/\/pack$/);
  await expect(page.getByTestId("pack")).toBeVisible();
  for (const code of ["G0", "A1", "S1", "S2", "S3", "E1", "A2", "M1", "M2", "M3", "M4"]) await expect(page.getByTestId(`sheet-${code}`)).toBeVisible();
  await expect(page.getByTestId("plan-sheet-floor").first()).toBeVisible();
  await expect(page.getByTestId("elevation-s")).toBeVisible();
  await expect(page.getByTestId("panel-schedule")).toContainText("GFCI");
  await expect(page.getByTestId("opening-schedule")).toContainText("D1");
  await expect(page.getByTestId("post-schedule")).toContainText("6×6");
  await expect(page.getByTestId("cut-list")).toContainText("Knee brace");
  await expect(page.getByTestId("hardware-table")).toContainText("carriage bolts");
  await expect(page.getByTestId("build-sequence")).toContainText("Site prep");
  await expect(page.getByTestId("materials-table")).toContainText("Sub-panel");
  await page.screenshot({ path: "test-results/pack.png", fullPage: true });
  for (const code of ["A1", "S2", "E1", "M2"]) await page.getByTestId(`sheet-${code}`).screenshot({ path: `test-results/pack-${code}.png` });
  await expect(page.getByTestId("print-pack")).toBeVisible();
});
