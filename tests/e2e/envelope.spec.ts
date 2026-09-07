import { expect, test } from "@playwright/test";

test("M1 envelope: add openings via context menu, edit, framing view, undo", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New barn" }).first().click();
  await page.waitForURL(/\/p\/[^/]+$/);
  await expect(page.getByTestId("plan-svg")).toBeVisible();
  await expect(page.getByTestId("viewer").locator("canvas")).toBeVisible();

  // Right-click the south wall in the plan -> Add door -> Sliding barn door.
  await page.getByTestId("plan-wall-s").click({ button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "Add door" }).hover();
  await page.getByRole("menuitem", { name: "Sliding barn door" }).click();
  await expect(page.getByTestId("plan-opening-slidingDoor")).toBeVisible();
  await expect(page.getByTestId("opening-width")).toHaveValue("8'");

  // Change size through the inspector; the plan updates.
  const width = page.getByTestId("opening-width");
  await width.fill("10");
  await width.press("Enter");
  await expect(width).toHaveValue("10'");

  // Add a window on the east wall via the context menu.
  await page.getByTestId("plan-wall-e").click({ button: "right", position: { x: 7, y: 60 } });
  await page.getByRole("menuitem", { name: "Add window" }).hover();
  await page.getByRole("menuitem", { name: /3' × 4'/ }).click();
  await expect(page.getByTestId("plan-opening-window")).toBeVisible();

  // Right-click the window -> Delete.
  await page.getByTestId("plan-opening-window").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByTestId("plan-opening-window")).toHaveCount(0);

  // Framing preset + layer panel exist; truss spec is shown.
  await page.getByRole("button", { name: "Framing" }).click();
  await expect(page.getByTestId("truss-spec")).toContainText("@ 48");
  await page.getByRole("button", { name: "Exterior" }).click();

  // Click a post in the plan -> member inspector with provenance.
  await page.locator('[data-testid="plan-svg"] rect[fill="#3a3835"]').first().click();
  await expect(page.getByTestId("member-inspector")).toContainText("framing.postFrame");

  // Cutaway toggle.
  await page.getByTestId("cut-toggle").check();
  await page.screenshot({ path: "test-results/envelope.png" });

  // Undo the door width change and the door add via keyboard (3 model edits so far: add door, resize, add window, delete window).
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+z"); // undo delete window -> window back
  await expect(page.getByTestId("plan-opening-window")).toHaveCount(1);
  await page.keyboard.press("Control+z"); // undo add window
  await expect(page.getByTestId("plan-opening-window")).toHaveCount(0);

  // Autosave lands.
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-status", "saved", { timeout: 10_000 });
  await page.reload();
  await expect(page.getByTestId("plan-opening-slidingDoor")).toBeVisible();
});
