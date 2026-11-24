import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyRange } from "@/lib/domain/money";
import { bySortOrder, commaList, groupBy } from "@/lib/domain/portfolio";
import { isValidSlug, slugify } from "@/lib/domain/slug";
import { formatDateRange, safeExternalUrl } from "@/lib/utils";

describe("slug rules", () => {
  it("produces predictable URL slugs", () => {
    expect(slugify("  Hello, World!  ")).toBe("hello-world");
    expect(slugify("Café & Résumé")).toBe("cafe-resume");
    expect(slugify("a".repeat(100))).toHaveLength(80);
  });

  it("rejects malformed slugs", () => {
    expect(isValidSlug("hello-world")).toBe(true);
    expect(isValidSlug("Hello-World")).toBe(false);
    expect(isValidSlug("--hello")).toBe(false);
    expect(isValidSlug("hello world")).toBe(false);
  });
});

describe("money formatting", () => {
  it("formats each currency explicitly", () => {
    expect(formatMoney(12.5, "EUR", "en-US")).toContain("€");
    expect(formatMoney(1000, "BDT", "en-US")).toMatch(/1,?000|BDT|৳/);
  });

  it("never sums different currencies", () => {
    const result = formatMoneyRange(
      [
        { amount: 10, currency: "EUR" },
        { amount: 1000, currency: "BDT" },
      ],
      "en-US",
    );
    expect(result).toContain("+");
  });

  it("sums within one currency", () => {
    expect(
      formatMoneyRange(
        [
          { amount: 10, currency: "EUR" },
          { amount: 5, currency: "EUR" },
        ],
        "en-US",
      ),
    ).toContain("15");
  });
});

describe("portfolio helpers", () => {
  it("sorts by explicit order", () => {
    expect(
      bySortOrder([{ sort_order: 2 }, { sort_order: 1 }]).map(
        (x) => x.sort_order,
      ),
    ).toEqual([1, 2]);
  });

  it("groups skills by category", () => {
    const groups = groupBy(
      [
        { category: "Data", name: "Postgres" },
        { category: "Data", name: "Redis" },
      ],
      (item) => item.category,
    );
    expect(groups.Data).toHaveLength(2);
  });

  it("parses comma and newline lists", () => {
    expect(commaList("React, Next.js\nTypeScript")).toEqual([
      "React",
      "Next.js",
      "TypeScript",
    ]);
  });
});

describe("formatting and URL safety", () => {
  it("formats ranges with present markers", () => {
    expect(formatDateRange("2024-01-01", null, true)).toContain("Present");
  });

  it("allows only safe schemes", () => {
    expect(safeExternalUrl("https://example.com")).toBe("https://example.com/");
    expect(safeExternalUrl("mailto:owner@example.com")).toBe(
      "mailto:owner@example.com",
    );
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
  });
});
