import { expect, goStep, newEmptyBarn, test } from "./fixtures";

test("looks: classic barn look adds a cupola, awnings, trim, wainscot and door lights", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await newEmptyBarn(page);
  await goStep(page, "outside");
  // A sliding door on the east wall to hang an awning and a light on.
  await page.getByTestId("tool-door").click();
  await page.getByTestId("door-picker").selectOption("slide10");
  await page.getByTestId("plan-wall-e").click({ position: { x: 7, y: 150 } });
  await expect(page.getByTestId("plan-opening-slidingDoor")).toHaveCount(1);
  await page.getByTestId("dock-back").click();

  // One click: the photo's look. The pickers show what it chose.
  await page.getByTestId("look-classic").click();
  await expect(page.getByTestId("cupola-size")).toHaveValue("42"); // 36' ridge -> 42" cupola
  await expect(page.getByTestId("trim-style")).toHaveValue("craftsman");
  await expect(page.getByTestId("wainscot-kind")).toHaveValue("stone");
  await expect(page.getByTestId("plan-awning")).toHaveCount(1);
  await expect(page.getByTestId("plan-fixture-gooseneck")).toHaveCount(1);
  await expect(page.getByTestId("viewer")).toBeVisible();

  // Each door has its own awning settings; the cupola size and wainscot height are editable.
  await page.getByTestId("item-list").locator("[data-testid^=item-]").first().click(); // the door, from the By wall list
  await expect(page.getByTestId("opening-awning")).toBeChecked();
  await page.getByTestId("awning-depth").selectOption("5");
  await page.getByTestId("dock-back").click();
  await page.getByTestId("cupola-size").selectOption("30");
  await page.getByTestId("wainscot-height").selectOption("4");
  await expect(page.getByTestId("cupola-count")).toBeEnabled();
  await page.screenshot({ path: "test-results/looks.png" });

  // Plain takes the decoration off again; the light stays.
  await page.getByTestId("look-plain").click();
  await expect(page.getByTestId("cupola-size")).toHaveValue("0");
  await expect(page.getByTestId("plan-awning")).toHaveCount(0);
  await expect(page.getByTestId("plan-fixture-gooseneck")).toHaveCount(1);

  // The estimate carries the cupola once it is back on.
  await page.getByTestId("look-classic").click();
  await goStep(page, "plans");
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved", { timeout: 15_000 }); // the pack reads the saved model
  await page.getByTestId("open-blueprints").click();
  await expect(page.getByTestId("materials-table")).toContainText("Cupola");
  await expect(page.getByTestId("materials-table")).toContainText("Weathervane");
  await expect(page.getByTestId("build-sequence")).toContainText("Cupola and weathervane");
});
