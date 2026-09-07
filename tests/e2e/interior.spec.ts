import { expect, test } from "@playwright/test";

test("M3 interior: stamp pens, layout generator, grow/fit envelope, edit and delete", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 860 });
  await page.goto("/");
  await page.getByRole("button", { name: "New barn" }).first().click();
  await page.waitForURL(/\/p\/[^/]+$/);
  await expect(page.getByTestId("plan-svg")).toBeVisible();

  // Pen tool: stamp a horse stall by clicking inside the footprint.
  await page.getByTestId("tool-pen").click();
  await expect(page.getByTestId("species-picker")).toBeVisible();
  const plan = page.getByTestId("plan-svg");
  const box = (await plan.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.7);
  await expect(page.getByTestId("plan-zone-pen")).toHaveCount(1);
  await expect(page.getByTestId("zone-width")).toHaveValue("12'");

  // Stamp a second one further north; the interior panel counts them.
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.35);
  await expect(page.getByTestId("plan-zone-pen")).toHaveCount(2);

  // Erase tool removes one.
  await page.getByTestId("tool-erase").click();
  await page.getByTestId("plan-zone-pen").first().click();
  await expect(page.getByTestId("plan-zone-pen")).toHaveCount(1);
  await page.keyboard.press("Escape"); // back to select
  await page.keyboard.press("Escape"); // deselect -> building inspector

  // Layout generator fills the barn and widens it for two rows of stalls + a 14' aisle.
  await page.getByTestId("layout-center-aisle").click();
  await expect(page.getByTestId("plan-zone-pen")).toHaveCount(6);
  await expect(page.getByTestId("plan-zone-aisle")).toHaveCount(1);
  await expect(page.getByTestId("input-width")).toHaveValue("38'");

  // Select the last-bay stall, change its species and deepen it; the building grows to fit on the bays.
  await page.getByTestId("plan-zone-pen").nth(4).click();
  await expect(page.getByTestId("zone-species")).toBeVisible();
  await page.getByTestId("zone-species").selectOption("goat");
  const depth = page.getByTestId("zone-depth");
  await depth.fill("20");
  await depth.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("input-depth")).toHaveValue("48'"); // 24 + 20 = 44 -> 48 on 8' bays

  // Delete that stall with the keyboard, then shrink-wrap the building back onto the bays.
  await page.getByTestId("plan-zone-pen").nth(4).click();
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("plan-zone-pen")).toHaveCount(5);
  await page.keyboard.press("Escape");
  await page.getByTestId("fit-envelope").click();
  await expect(page.getByTestId("input-depth")).toHaveValue("40'"); // aisle runs 36'; 36 -> 40 on 8' bays

  // Right-click a stall -> Outside access adds a Dutch door on the exterior wall.
  await page.getByTestId("plan-zone-pen").nth(1).click({ button: "right" });
  await page.getByRole("menuitem", { name: /Outside access/ }).click();
  await expect(page.getByTestId("plan-opening-dutchDoor")).toHaveCount(1);

  // 3D shows partitions; autosave lands; reload keeps the interior.
  await page.getByRole("button", { name: "Dollhouse" }).click();
  await page.screenshot({ path: "test-results/interior.png" });
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved", { timeout: 10_000 });
  await page.reload();
  await expect(page.getByTestId("plan-zone-pen")).toHaveCount(5);
});
