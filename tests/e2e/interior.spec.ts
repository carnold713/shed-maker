import { expect, goStep, newEmptyBarn, pickView, test } from "./fixtures";

test("M3 layout: stamp stalls, layout generator, grow/fit, doors, edit and delete", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await newEmptyBarn(page);
  await expect(page.getByTestId("empty-state")).toContainText("No stalls yet");

  // Stall tool: pick the animal, stamp a horse stall by clicking inside the walls.
  await page.getByTestId("tool-pen").click();
  await expect(page.getByTestId("species-picker")).toBeVisible();
  await expect(page.getByTestId("status-hint")).toContainText("horse stall");
  const plan = page.getByTestId("plan-svg");
  const box = (await plan.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.7);
  await expect(page.getByTestId("plan-zone-pen")).toHaveCount(1);
  await expect(page.getByTestId("zone-width")).toHaveValue("12'");

  // The stamp tool stays armed: a second stall further north.
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.35);
  await expect(page.getByTestId("plan-zone-pen")).toHaveCount(2);

  // Esc → Select, Esc → clear selection; the Remove tool takes one away.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByTestId("tool-erase").click();
  await page.getByTestId("plan-zone-pen").first().click();
  await expect(page.getByTestId("plan-zone-pen")).toHaveCount(1);
  await page.keyboard.press("Escape");

  // Layouts ▾ → Center aisle fills the barn and widens it for two rows + a 14' aisle.
  await page.getByTestId("layouts-menu").click();
  await page.getByTestId("layout-center-aisle").click();
  await expect(page.getByTestId("plan-zone-pen")).toHaveCount(6);
  await expect(page.getByTestId("plan-zone-aisle")).toHaveCount(1);
  await expect(page.getByTestId("status-facts")).toContainText("38' × 36'");

  // Every stall got a default sliding door to the aisle; clicking one makes it editable; change it to a Dutch door.
  await expect(page.getByTestId("plan-door-stallSlide")).toHaveCount(6);
  await page.getByTestId("plan-door-stallSlide").first().click();
  await expect(page.getByTestId("interior-door-type")).toBeVisible();
  await page.getByTestId("interior-door-type").selectOption("dutch");
  await expect(page.getByTestId("plan-door-dutch")).toHaveCount(1);
  await expect(page.getByTestId("plan-door-stallSlide")).toHaveCount(5);
  await page.getByTestId("dock-back").click();

  // Select the last-bay stall, change its animal and deepen it; the building grows to fit on the post spacing.
  await page.getByTestId("plan-zone-pen").nth(4).click();
  await expect(page.getByTestId("zone-species")).toBeVisible();
  await page.getByTestId("zone-species").selectOption("goat");
  const depth = page.getByTestId("zone-depth");
  await depth.fill("20");
  await depth.press("Enter");
  await expect(page.getByTestId("status-facts")).toContainText("38' × 48'"); // 24 + 20 = 44 -> 48 on 8' spacing

  // Delete that stall with the keyboard, then shrink the building back onto the post spacing.
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("plan-zone-pen")).toHaveCount(5);
  await page.getByTestId("fit-envelope").click();
  await expect(page.getByTestId("status-facts")).toContainText("38' × 40'"); // aisle runs 36'; 36 -> 40

  // Right-click a stall -> door to the outside adds a Dutch door on the exterior wall.
  await page.getByTestId("plan-zone-pen").nth(1).click({ button: "right" });
  await page.getByRole("menuitem", { name: /Door to the outside/ }).click();
  await expect(page.getByTestId("plan-opening-dutchDoor")).toHaveCount(1);

  // 3D cutaway shows partitions; autosave lands; reload keeps the interior.
  await pickView(page, "view-cutaway");
  await page.screenshot({ path: "test-results/interior.png" });
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved", { timeout: 10_000 });
  await page.reload();
  await expect(page.getByTestId("plan-zone-pen")).toHaveCount(5);
  await goStep(page, "layout");
  await expect(page.getByTestId("item-list")).toContainText("Center aisle");
});
