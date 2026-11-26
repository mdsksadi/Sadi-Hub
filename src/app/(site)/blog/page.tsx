import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import {
  getPublicCategories,
  getPublicTagLinks,
  getPublicTags,
  getPublishedPosts,
} from "@/lib/data/blog";
import { excerptFromMarkdown, formatReadingTime } from "@/lib/domain/blog";
import { PUBLIC_BUCKET, publicObjectUrl } from "@/lib/supabase/storage";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Blog",
  description: "Writing, notes and reflections by Sadi.",
};

const PAGE_SIZE = 6;

type SearchValue = string | string[] | undefined;
type BlogSearchParams = {
  q?: SearchValue;
  category?: SearchValue;
  tag?: SearchValue;
  page?: SearchValue;
};
type Tag = Awaited<ReturnType<typeof getPublicTags>>[number];
type Filters = { q: string; category: string; tag: string };

function firstValue(value: SearchValue): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function blogHref(
  filters: Filters & { page?: number } = { q: "", category: "", tag: "" },
): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }
  const query = params.toString();
  return query ? `/blog?${query}` : "/blog";
}

function tagsForPosts(
  links: Array<{ post_id: string; tag_id: string }>,
  tags: Tag[],
): Map<string, Tag[]> {
  const byPost = new Map<string, Tag[]>();
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
  for (const link of links) {
    const tag = tagsById.get(link.tag_id);
    if (!tag) continue;
    const current = byPost.get(link.post_id) ?? [];
    current.push(tag);
    byPost.set(link.post_id, current);
  }
  return byPost;
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<BlogSearchParams>;
}) {
  const params = await searchParams;
  const filters: Filters = {
    q: firstValue(params.q).trim(),
    category: firstValue(params.category).trim(),
    tag: firstValue(params.tag).trim(),
  };
  const requestedPage = Number.parseInt(firstValue(params.page), 10);
  const page =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [{ posts, total, pageSize, page: resultPage }, categories, allTags] =
    await Promise.all([
      getPublishedPosts({
        q: filters.q || undefined,
        category: filters.category || undefined,
        tag: filters.tag || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
      getPublicCategories(),
      getPublicTags(),
    ]);

  const tagLinks = await getPublicTagLinks(posts.map((post) => post.id));
  const tagsByPost = tagsForPosts(tagLinks, allTags);
  const categoriesById = new Map(categories.map((item) => [item.id, item]));
  const pageCount = Math.max(1, Math.ceil(total / (pageSize || PAGE_SIZE)));
  const currentPage = Math.min(Math.max(1, resultPage), pageCount);
  const hasFilters = Boolean(filters.q || filters.category || filters.tag);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
        <p className="text-muted-foreground mt-2">
          Notes on building, learning and everything in between.
        </p>
      </header>

      <form
        action="/blog"
        method="get"
        className="bg-card rounded-xl border p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-end">
          <div>
            <Label htmlFor="blog-q">Search</Label>
            <Input
              id="blog-q"
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="Search posts…"
            />
          </div>
          <div>
            <Label htmlFor="blog-category">Category</Label>
            <select
              id="blog-category"
              name="category"
              defaultValue={filters.category}
              className="bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="blog-tag">Tag</Label>
            <select
              id="blog-tag"
              name="tag"
              defaultValue={filters.tag}
              className="bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">All tags</option>
              {allTags.map((tag) => (
                <option key={tag.id} value={tag.slug}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">Apply filters</Button>
        </div>
      </form>

      {posts.length === 0 ? (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            No published posts match those filters.
          </p>
          {hasFilters && (
            <Button asChild variant="outline">
              <Link href="/blog">Clear filters</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {total} {total === 1 ? "post" : "posts"} found
          </p>
          <div className="grid gap-5 md:grid-cols-2">
            {posts.map((post) => {
              const cover = publicObjectUrl(PUBLIC_BUCKET, post.cover_path);
              const category = post.category_id
                ? categoriesById.get(post.category_id)
                : undefined;
              const postTags = tagsByPost.get(post.id) ?? [];
              const excerpt =
                post.excerpt?.trim() || excerptFromMarkdown(post.content_md);
              const published = formatDate(post.published_at);

              return (
                <Card key={post.id} className="overflow-hidden">
                  {cover && (
                    <Image
                      src={cover}
                      alt=""
                      width={640}
                      height={320}
                      unoptimized
                      className="h-44 w-full object-cover"
                    />
                  )}
                  <CardHeader>
                    <CardTitle>
                      <Link
                        href={`/blog/${post.slug}`}
                        className="hover:underline"
                      >
                        {post.title}
                      </Link>
                    </CardTitle>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      {published && (
                        <time dateTime={post.published_at ?? undefined}>
                          {published}
                        </time>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{formatReadingTime(post.reading_minutes)}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {excerpt && (
                      <p className="text-muted-foreground text-sm">{excerpt}</p>
                    )}
                    {(category || postTags.length > 0) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {category && (
                          <Link
                            href={blogHref({
                              ...filters,
                              category: category.slug,
                              tag: "",
                            })}
                          >
                            <Badge>{category.name}</Badge>
                          </Link>
                        )}
                        {postTags.map((tag) => (
                          <Link
                            key={tag.id}
                            href={blogHref({
                              ...filters,
                              category: "",
                              tag: tag.slug,
                            })}
                          >
                            <Badge>{tag.name}</Badge>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {pageCount > 1 && (
            <nav
              aria-label="Blog pagination"
              className="flex flex-wrap items-center justify-center gap-4 text-sm"
            >
              {currentPage > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={blogHref({ ...filters, page: currentPage - 1 })}
                    rel="prev"
                  >
                    ← Previous
                  </Link>
                </Button>
              ) : (
                <span className="text-muted-foreground opacity-60">
                  ← Previous
                </span>
              )}
              <span className="text-muted-foreground">
                Page {currentPage} of {pageCount}
              </span>
              {currentPage < pageCount ? (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={blogHref({ ...filters, page: currentPage + 1 })}
                    rel="next"
                  >
                    Next →
                  </Link>
                </Button>
              ) : (
                <span className="text-muted-foreground opacity-60">Next →</span>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
