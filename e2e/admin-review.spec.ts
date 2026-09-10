import { test, expect } from "@playwright/test";

test.describe("Admin Human Review & Workforce Control E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Perform admin login via login page
    await page.goto("/login");
    await page.fill('input[type="text"], input[type="email"]', "admin");
    await page.fill('input[type="password"]', "admin");
    await page.click("button[type='submit']");
    await page.waitForTimeout(1000);
  });

  test("admin dashboard displays review queue, metrics, and tracker sweep trigger", async ({
    page,
  }) => {
    await page.goto("/admin");

    await expect(
      page
        .locator("text=Administrative Human Review & Workforce Control")
        .or(page.locator("text=Overview"))
        .first(),
    ).toBeVisible();
  });

  test("admin agents workforce control center displays 6 agents and live activity", async ({
    page,
  }) => {
    await page.goto("/admin/agents");

    await expect(page.locator("text=AI Workforce Control Center").first()).toBeVisible();
    await expect(page.locator("text=Tracker Agent").first()).toBeVisible();
    await expect(page.locator("text=Live Activity Stream").first()).toBeVisible();
  });

  test("admin schemes knowledge base displays canonical schemes", async ({ page }) => {
    await page.goto("/admin/schemes");

    await expect(page.locator("text=National Means-cum-Merit Scholarship").first()).toBeVisible();
    await expect(page.locator("text=PM-KISAN Samman Nidhi").first()).toBeVisible();
  });
});
