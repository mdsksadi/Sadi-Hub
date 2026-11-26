import { expect, test } from "@playwright/test";

const DOCUMENT_ID = "00000000-0000-4000-8000-000000000099";

const adminPaths = ["/admin/property", "/admin/documents", "/admin/audit-logs"];

const privateApiPaths = [
  "/api/exports/csv?resource=ledger",
  "/api/exports/pdf?report=monthly",
  `/api/documents/${DOCUMENT_ID}`,
];

test("property, document and audit pages are private and never cached", async ({
  request,
}) => {
  for (const path of adminPaths) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect([302, 307], `unexpected status for ${path}`).toContain(
      response.status(),
    );
    expect(response.headers()["location"]).toContain("/admin/login");
    const cacheControl = response.headers()["cache-control"] ?? "";
    expect(cacheControl, `missing private no-store on ${path}`).toContain(
      "private",
    );
    expect(cacheControl, `missing private no-store on ${path}`).toContain(
      "no-store",
    );
  }
});

test("exports and document downloads deny anonymous callers", async ({
  request,
}) => {
  for (const path of privateApiPaths) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect([401, 302, 307], `unexpected status for ${path}`).toContain(
      response.status(),
    );
    const cacheControl = response.headers()["cache-control"] ?? "";
    expect(cacheControl, `missing private no-store on ${path}`).toContain(
      "private",
    );
    expect(cacheControl, `missing private no-store on ${path}`).toContain(
      "no-store",
    );
  }
});

test("anonymous export responses carry no private payload", async ({
  request,
}) => {
  for (const path of privateApiPaths) {
    const response = await request.get(path, { maxRedirects: 0 });
    const body = await response.body();
    const text = body.toString("utf8");
    expect(
      body.length,
      `${path} returned a body to an anonymous caller`,
    ).toBeLessThan(512);
    expect(text, `${path} leaked a generated report`).not.toMatch(
      /attachment|financial_transactions|%PDF-/,
    );
  }
});
