import { describe, expect, it } from "vitest";
import {
  excerptFromMarkdown,
  isPublicPost,
  readingMinutes,
  relatedPosts,
} from "@/lib/domain/blog";
import { postSchema } from "@/lib/validation/schemas";

const PAST = "2026-11-23T12:00:00.000Z";
const FUTURE = "2026-11-25T12:00:00.000Z";
const NOW = new Date("2026-11-24T12:00:00.000Z");

describe("readingMinutes", () => {
  it("uses a one-minute floor for empty and short content", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes(null)).toBe(1);
    expect(readingMinutes(undefined)).toBe(1);
    expect(readingMinutes("x".repeat(1200))).toBe(1);
  });

  it("rounds up once content exceeds 1200 characters", () => {
    expect(readingMinutes("x".repeat(1201))).toBe(2);
    expect(readingMinutes("x".repeat(2400))).toBe(2);
    expect(readingMinutes("x".repeat(2401))).toBe(3);
  });
});

describe("isPublicPost", () => {
  it("accepts a published post whose publish time has passed", () => {
    expect(
      isPublicPost(
        { status: "published", published_at: PAST, deleted_at: null },
        NOW,
      ),
    ).toBe(true);
  });

  it("rejects drafts, deleted posts, missing dates and future publish times", () => {
    expect(
      isPublicPost(
        { status: "draft", published_at: PAST, deleted_at: null },
        NOW,
      ),
    ).toBe(false);
    expect(
      isPublicPost(
        { status: "scheduled", published_at: FUTURE, deleted_at: null },
        NOW,
      ),
    ).toBe(false);
    expect(
      isPublicPost(
        {
          status: "published",
          published_at: PAST,
          deleted_at: "2026-11-24T08:00:00.000Z",
        },
        NOW,
      ),
    ).toBe(false);
    expect(
      isPublicPost(
        { status: "published", published_at: null, deleted_at: null },
        NOW,
      ),
    ).toBe(false);
    expect(
      isPublicPost(
        { status: "published", published_at: FUTURE, deleted_at: null },
        NOW,
      ),
    ).toBe(false);
  });
});

describe("excerptFromMarkdown", () => {
  it("strips code fences, markdown links and heading markers", () => {
    const markdown = [
      "## Architecture",
      "",
      "A [linked guide](https://example.com/guide) with `inline code`.",
      "",
      "```ts",
      'const hidden = "secret";',
      "```",
      "",
      "Everything private is protected by RLS.",
    ].join("\n");

    const excerpt = excerptFromMarkdown(markdown);
    expect(excerpt).toBe(
      "Architecture A linked guide with inline code. Everything private is protected by RLS.",
    );
    expect(excerpt).not.toContain("hidden");
    expect(excerpt).not.toContain("https://example.com");
  });

  it("truncates long content with an ellipsis", () => {
    const excerpt = excerptFromMarkdown("a".repeat(200));
    expect(excerpt).toHaveLength(181);
    expect(excerpt.startsWith("a".repeat(180))).toBe(true);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  it("returns an empty string for empty content", () => {
    expect(excerptFromMarkdown("")).toBe("");
    expect(excerptFromMarkdown(null)).toBe("");
    expect(excerptFromMarkdown(undefined)).toBe("");
  });
});

describe("relatedPosts", () => {
  const posts = [
    { id: "current", category_id: "engineering" },
    { id: "same-tags", category_id: "personal" },
    { id: "same-category", category_id: "engineering" },
    { id: "unrelated", category_id: "personal" },
  ];
  const tagIdsByPost = {
    current: ["nextjs", "supabase"],
    "same-tags": ["supabase", "nextjs"],
    "same-category": [] as string[],
    unrelated: ["security"],
  };

  it("ranks shared tags above shared category and excludes the current post", () => {
    expect(
      relatedPosts({
        posts,
        currentId: "current",
        categoryId: "engineering",
        tagIdsByPost,
      }).map((post) => post.id),
    ).toEqual(["same-tags", "same-category"]);
  });

  it("respects the limit and ignores category matches without a category", () => {
    expect(
      relatedPosts({
        posts,
        currentId: "current",
        categoryId: null,
        tagIdsByPost,
        limit: 1,
      }).map((post) => post.id),
    ).toEqual(["same-tags"]);
  });

  it("returns no posts when nothing is shared", () => {
    expect(
      relatedPosts({
        posts,
        currentId: "unrelated",
        categoryId: null,
        tagIdsByPost,
      }),
    ).toEqual([]);
  });
});

describe("postSchema", () => {
  const validPost = {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Building Sadi Hub",
    slug: "building-sadi-hub",
    excerpt: "How this single-owner hub is put together.",
    contentMd: "## Architecture\n\nA modular monolith.",
    coverPath: "",
    status: "published",
    publishedAt: PAST,
    scheduledFor: "",
    seoTitle: "",
    seoDescription: "",
    isFeatured: true,
    categoryId: "00000000-0000-4000-8000-000000000002",
    tagIds: ["00000000-0000-4000-8000-000000000003"],
  };

  it("accepts a valid published post with a publish date", () => {
    expect(postSchema.safeParse(validPost).success).toBe(true);
  });

  it("rejects a malformed slug", () => {
    expect(
      postSchema.safeParse({ ...validPost, slug: "Bad Slug" }).success,
    ).toBe(false);
  });

  it("rejects a published post without a publish date", () => {
    const result = postSchema.safeParse({ ...validPost, publishedAt: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "publishedAt"),
      ).toBe(true);
    }
  });

  it("rejects a scheduled post without a scheduled date", () => {
    const result = postSchema.safeParse({
      ...validPost,
      status: "scheduled",
      publishedAt: "",
      scheduledFor: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "scheduledFor"),
      ).toBe(true);
    }
  });
});
