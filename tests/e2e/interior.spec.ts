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
  await page.keyboard.press("Escape");

  // Door tool: a hinged stall door on the wall between two stalls (a click on the stall tile must reach the tool).
  await page.getByTestId("tool-interior-door").click();
  await page.getByTestId("interior-door-picker").selectOption("int:stallHinged");
  const firstPen = (await page.getByTestId("plan-zone-pen").first().boundingBox())!;
  await page.mouse.move(firstPen.x + firstPen.width / 2, firstPen.y + 4);
  await expect(page.getByTestId("status-hint")).toContainText("Click to add a hinged stall door");
  await page.mouse.click(firstPen.x + firstPen.width / 2, firstPen.y + 4);
  await expect(page.getByTestId("plan-door-stallHinged")).toHaveCount(1);
  await expect(page.getByTestId("dock-title")).toContainText("Hinged stall door");
  await page.keyboard.press("Escape"); // clear the selection -> Layout panel

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

  // Aisle doors: the inspector's end-door action adds a sliding door on each outside wall the aisle reaches.
  // Here the aisle runs 36' in a 40' barn, so only its south end is on a wall.
  await page.getByTestId("plan-zone-aisle").first().click();
  await expect(page.getByTestId("dock-title")).toContainText("Center aisle");
  await expect(page.getByTestId("aisle-end-doors")).toHaveText("Door at the south end");
  await page.getByTestId("aisle-end-doors").click();
  await expect(page.getByTestId("plan-opening-slidingDoor")).toHaveCount(1);
  await expect(page.getByTestId("dock-title")).toContainText("Sliding door");
  await page.keyboard.press("Escape");
  // An inside side of the aisle (here the north, facing the open floor) gets a sliding aisle door sized to the aisle.
  await page.getByTestId("plan-zone-aisle").first().click();
  await page.getByTestId("zone-door-n").click();
  await expect(page.getByTestId("plan-door-aisleSlide")).toHaveCount(1);
  await expect(page.getByTestId("dock-title")).toContainText("Sliding aisle door");
  await page.keyboard.press("Escape");

  // One Door tool: with an outside door picked, clicking a stall's inside wall still adds its usual stall door,
  // and with a stall door picked, clicking an outside wall adds a door sized for the space behind it.
  await goStep(page, "layout");
  await page.getByTestId("tool-interior-door").click();
  await page.getByTestId("interior-door-picker").selectOption("ext:slide10");
  const pen0 = (await page.getByTestId("plan-zone-pen").first().boundingBox())!;
  await page.mouse.move(pen0.x + pen0.width / 2, pen0.y + 4);
  await expect(page.getByTestId("status-hint")).toContainText("Click to add a sliding stall door");
  await page.keyboard.press("Escape");
  await page.getByTestId("plan-zone-pen").nth(2).click();
  await page.getByTestId("zone-door-sides").getByText("⌂").first().click(); // a side marked ⌂ is an outside wall
  await expect(page.getByTestId("dock-title")).toContainText("Dutch door");
  await expect(page.getByTestId("plan-opening-dutchDoor")).toHaveCount(2);
  await page.keyboard.press("Escape");

  // Roof-off 3D shows partitions; autosave lands; reload keeps the interior.
  await pickView(page, "view-noroof");
  await page.screenshot({ path: "test-results/interior.png" });
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved", { timeout: 10_000 });
  await page.reload();
  await expect(page.getByTestId("plan-zone-pen")).toHaveCount(5);
  await goStep(page, "layout");
  await expect(page.getByTestId("item-list")).toContainText("Center aisle");
});
