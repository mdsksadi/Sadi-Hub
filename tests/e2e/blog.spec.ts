import { expect, test } from "@playwright/test";

const PUBLISHED_TITLE = "Building Sadi Hub";
const DRAFT_TITLE = "Draft: Unpublished Notes";
const SCHEDULED_TITLE = "Scheduled: Next Week";
const DRAFT_PATH = "/blog/draft-unpublished-notes";
const SCHEDULED_PATH = "/blog/scheduled-next-week";

test.describe("blog", () => {
  test("index shows the published post and not the draft or scheduled posts", async ({
    page,
    request,
  }) => {
    await page.goto("/blog");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: PUBLISHED_TITLE }),
    ).toBeVisible();

    await expect(page.locator(`a[href="${DRAFT_PATH}"]`)).toHaveCount(0);
    await expect(page.locator(`a[href="${SCHEDULED_PATH}"]`)).toHaveCount(0);

    const html = await (await request.get("/blog")).text();
    expect(html).not.toContain("draft-unpublished-notes");
    expect(html).not.toContain("scheduled-next-week");

    for (const path of [DRAFT_PATH, SCHEDULED_PATH]) {
      const response = await request.get(path);
      expect(response.status()).toBe(404);
    }
  });

  test("published article renders its heading and markdown content", async ({
    page,
  }) => {
    await page.goto("/blog/building-sadi-hub");
    await expect(
      page.getByRole("heading", { level: 1, name: PUBLISHED_TITLE }),
    ).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toContain("Architecture");
    expect(bodyText).toContain("modular monolith");
  });

  test("RSS feed includes published posts and excludes drafts", async ({
    request,
  }) => {
    const response = await request.get("/rss.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/xml/i);

    const xml = await response.text();
    expect(xml).toContain(PUBLISHED_TITLE);
    expect(xml).not.toContain(DRAFT_TITLE);
    expect(xml).not.toContain(SCHEDULED_TITLE);
  });

  test("search filters to the matching published post", async ({ page }) => {
    await page.goto("/blog?q=building");
    await expect(
      page.getByRole("heading", { name: PUBLISHED_TITLE }),
    ).toBeVisible();
    await expect(page.getByText(DRAFT_TITLE)).toHaveCount(0);
    await expect(page.getByText(SCHEDULED_TITLE)).toHaveCount(0);
  });
});
