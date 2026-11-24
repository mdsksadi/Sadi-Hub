import { expect, test } from "@playwright/test";

test("public pages render with a navigation and footer", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
});

test("contact form is available publicly", async ({ page }) => {
  await page.goto("/contact");
  await expect(
    page.getByRole("button", { name: /send message/i }),
  ).toBeVisible();
});

test("resume page never exposes a storage URL", async ({ request }) => {
  const response = await request.get("/resume");
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).not.toContain("/storage/v1/object/");
  expect(html).not.toContain("documents/");
});

test("invalid contact payloads are rejected", async ({ request }) => {
  const response = await request.post("/api/contact", {
    data: { name: "A", email: "bad", message: "short", website: "" },
    headers: { origin: "http://127.0.0.1:3000" },
  });
  expect(response.status()).toBeGreaterThanOrEqual(400);
  expect(response.headers()["cache-control"]).toContain("no-store");
});
