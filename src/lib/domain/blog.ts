import type { Post, PostStatus } from "../../../types/supabase";

/** Matches the generated column in the posts table. */
export function readingMinutes(content: string | null | undefined): number {
  return Math.max(1, Math.ceil((content?.length ?? 0) / 1200));
}

export function formatReadingTime(minutes: number): string {
  return `${Math.max(1, minutes)} min read`;
}

export function isPublicPost(
  post: Pick<Post, "status" | "published_at" | "deleted_at">,
  now: Date = new Date(),
): boolean {
  if (post.deleted_at) return false;
  if (post.status !== "published" || !post.published_at) return false;
  const published = Date.parse(post.published_at);
  return Number.isFinite(published) && published <= now.getTime();
}

export function postStatusLabel(status: PostStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "scheduled":
      return "Scheduled";
    case "published":
      return "Published";
    case "archived":
      return "Archived";
  }
}

/** Small, deterministic excerpt helper; the database stores the real excerpt. */
export function excerptFromMarkdown(
  content: string | null | undefined,
  max = 180,
): string {
  if (!content) return "";
  const text = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/[>*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

/**
 * Related posts are scored by shared tags (2 points) and shared category
 * (1 point). Pure so both the data layer and unit tests use one rule.
 */
export function relatedPosts<
  T extends { id: string; category_id: string | null },
>(options: {
  posts: T[];
  currentId: string;
  categoryId: string | null;
  tagIdsByPost: Record<string, string[]>;
  limit?: number;
}): T[] {
  const { posts, currentId, categoryId, tagIdsByPost, limit = 3 } = options;
  const currentTags = new Set(tagIdsByPost[currentId] ?? []);

  return posts
    .filter((post) => post.id !== currentId)
    .map((post) => {
      const tags = tagIdsByPost[post.id] ?? [];
      const sharedTags = tags.reduce(
        (total, tag) => total + (currentTags.has(tag) ? 2 : 0),
        0,
      );
      const sharedCategory =
        categoryId && post.category_id === categoryId ? 1 : 0;
      return { post, score: sharedTags + sharedCategory };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.post.id.localeCompare(b.post.id))
    .slice(0, limit)
    .map((entry) => entry.post);
}
