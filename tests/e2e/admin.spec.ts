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

test("finance pages are private and never cached", async ({ request }) => {
  const paths = [
    "/admin/finance",
    "/admin/finance/accounts",
    "/admin/finance/categories",
    "/admin/finance/transactions",
    "/admin/finance/transfers",
    "/admin/finance/contacts",
    "/admin/finance/contacts/00000000-0000-4000-8000-000000000011",
    "/admin/finance/lending",
    "/admin/finance/borrowing",
    "/admin/finance/donations",
    "/admin/finance/reports",
    "/admin/finance/rates",
  ];

  for (const path of paths) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect([302, 307]).toContain(response.status());
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});
