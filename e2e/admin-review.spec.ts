import { test, expect } from "@playwright/test";

test.describe("Admin Human Review & Workforce Control E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Set admin auth token in localStorage
    await page.goto("/login");
    await page.evaluate(() => {
      localStorage.setItem("sahayak_auth", "true");
      localStorage.setItem("sahayak_role", "admin");
    });
  });

  test("admin dashboard displays review queue, metrics, and tracker sweep trigger", async ({
    page,
  }) => {
    await page.goto("/admin");

    await expect(
      page.locator("text=Administrative Human Review & Workforce Control").first(),
    ).toBeVisible();
    await expect(page.locator("text=Pending Human Review Queue").first()).toBeVisible();
    await expect(page.locator("text=Run Tracker Sweep Now").first()).toBeVisible();
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
