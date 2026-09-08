import { expect, newEmptyBarn, test } from "./fixtures";

test("walk inside: mini overhead map, drop in at eye height, drag to look, set eye height", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await newEmptyBarn(page);
  await page.getByTestId("layouts-menu").click();
  await page.getByTestId("layout-center-aisle").click();
  await expect(page.getByTestId("plan-zone-pen").first()).toBeVisible();
  // Walk inside from the View menu: the mini map appears with the person on it.
  await page.getByTestId("view-menu").click();
  await page.getByTestId("walk-toggle").click();
  const mini = page.getByTestId("mini-map");
  await expect(mini).toBeVisible();
  await expect(mini).toHaveAttribute("data-walk-on", "1");
  await expect(mini).toHaveAttribute("data-walk-eye", "6");
  await expect(page.getByTestId("viewer")).toHaveAttribute("data-walk", "1");
  // Click a spot on the little map: the person moves there.
  const x0 = await mini.getAttribute("data-walk-x");
  const svg = (await page.getByTestId("mini-map-svg").boundingBox())!;
  await page.mouse.click(svg.x + svg.width * 0.35, svg.y + svg.height * 0.35);
  await expect(mini).not.toHaveAttribute("data-walk-x", x0 ?? "");
  // Drag on the 3D view turns the camera in place.
  const yaw0 = await mini.getAttribute("data-walk-yaw");
  const viewer = (await page.getByTestId("viewer").boundingBox())!;
  await page.mouse.move(viewer.x + viewer.width * 0.4, viewer.y + viewer.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(viewer.x + viewer.width * 0.4 + 150, viewer.y + viewer.height * 0.5, { steps: 6 });
  await page.mouse.up();
  await expect(mini).not.toHaveAttribute("data-walk-yaw", yaw0 ?? "");
  // Eye height is a person's: set it to 5'6".
  await page.getByTestId("walk-eye").fill("5.5");
  await expect(mini).toHaveAttribute("data-walk-eye", "5.5");
  // W walks forward; Esc leaves the walk and orbit comes back.
  await page.getByTestId("viewer").click({ position: { x: 200, y: 200 } }); // focus leaves the eye-height box
  const y0 = await mini.getAttribute("data-walk-y");
  await page.keyboard.press("w");
  await expect(mini).not.toHaveAttribute("data-walk-y", y0 ?? "");
  await page.screenshot({ path: "test-results/walk.png" });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("viewer")).toHaveAttribute("data-walk", "0");
});
