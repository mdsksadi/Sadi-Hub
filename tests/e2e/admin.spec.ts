import { expect, test } from "@playwright/test";

test("unauthenticated visitors cannot reach admin pages", async ({ page }) => {
  const response = await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/login/);
  expect(response?.status()).toBeLessThan(500);
});

test("admin login page advertises MFA", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(
    page.getByRole("heading", { name: "Admin sign in" }),
  ).toBeVisible();
  await expect(page.getByText("MFA is required.")).toBeVisible();
});

test("auth redirects and login are never cached", async ({ request }) => {
  const login = await request.get("/admin/login", { maxRedirects: 0 });
  expect(login.headers()["cache-control"]).toContain("no-store");

  const redirect = await request.get("/admin/dashboard", {
    maxRedirects: 0,
  });
  expect([302, 307]).toContain(redirect.status());
  expect(redirect.headers()["cache-control"]).toContain("no-store");
});

test("MFA setup is not publicly accessible without a session", async ({
  page,
}) => {
  await page.goto("/mfa/setup");
  await expect(page).toHaveURL(/\/admin\/login/);
});
