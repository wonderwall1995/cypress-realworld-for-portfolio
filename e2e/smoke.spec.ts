import { test, expect } from "@playwright/test";

test("redirects anonymous users to the sign-in page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin/);
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
});
