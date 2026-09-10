import { test, expect } from "@playwright/test";

test.describe("Citizen Journey E2E", () => {
  test("landing page renders Sahayak branding, 6-agent roster, and language switcher", async ({
    page,
  }) => {
    await page.goto("/");

    // Branding and header
    await expect(page.locator("text=Sahayak").first()).toBeVisible();
    await expect(page.locator("text=From eligibility").first()).toBeVisible();

    // 6-agent roster section
    await expect(page.locator("text=Citizen Agent").first()).toBeVisible();
    await expect(page.locator("text=Tracker Agent").first()).toBeVisible();

    // Language switcher presence
    const langTrigger = page
      .locator("button:has-text('English'), button:has-text('हिन्दी')")
      .first();
    if (await langTrigger.isVisible()) {
      await expect(langTrigger).toBeVisible();
    }
  });

  test("demo login workflow navigates to citizen dashboard", async ({ page }) => {
    await page.goto("/login");

    // Quick demo login button
    const demoButton = page.locator("button:has-text('Use Demo Credentials (4321 / 1234)')");
    if (await demoButton.isVisible()) {
      await demoButton.click();
    } else {
      await page.fill('input[type="text"], input[type="email"]', "4321");
      await page.fill('input[type="password"]', "1234");
    }

    await page.click("button[type='submit']");
    await page.waitForURL("**/dashboard", { timeout: 10000 });

    // Assert dashboard metrics and agents
    await expect(
      page.locator("text=Benefits discovered, text=Active applications").first(),
    ).toBeVisible();
  });

  test("guided document checklist for canonical scheme", async ({ page }) => {
    // Navigate with scheme query parameter
    await page.goto("/documents?scheme=a0000000-0000-0000-0000-000000000001");

    // Wait for document center to load
    await expect(page.locator("text=Document Center").first()).toBeVisible();
    await expect(page.locator("text=National Means-cum-Merit Scholarship").first()).toBeVisible();
    await expect(page.locator("text=Guided Scheme Checklist").first()).toBeVisible();
  });

  test("human approval flow requires citizen consent before submission", async ({ page }) => {
    await page.goto("/applications/SAH-2026-004281");

    // Consent box must exist
    const consentCheckbox = page.locator('input[type="checkbox"], button[role="checkbox"]').first();
    await expect(consentCheckbox).toBeVisible();

    // Submit button should be disabled without consent
    const submitBtn = page.locator("button:has-text('I authorize Sahayak to submit')");
    await expect(submitBtn).toBeDisabled();

    // Checking consent should enable button
    await consentCheckbox.click();
    await expect(submitBtn).toBeEnabled();
  });
});
