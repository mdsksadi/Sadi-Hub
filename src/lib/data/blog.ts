import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { relatedPosts } from "@/lib/domain/blog";
import { getSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type {
  BlogCategory,
  BlogTag,
  Database,
  Post,
  PostDetail,
} from "../../../types/supabase";

async function logDataError(scope: string, message: string): Promise<void> {
  console.error(JSON.stringify({ level: "error", scope, message }));
}

export type BlogQuery = {
  q?: string;
  category?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
};

export type PostListResult = {
  posts: Post[];
  total: number;
  page: number;
  pageSize: number;
};

const emptyList = (page: number, pageSize: number): PostListResult => ({
  posts: [],
  total: 0,
  page,
  pageSize,
});

function publicPostFilter<const T extends string = "*">(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  columns: T = "*" as T,
) {
  return supabase
    .from("posts")
    .select(columns)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .is("deleted_at", null);
}

export async function getPublishedPosts(
  query: BlogQuery = {},
): Promise<PostListResult> {
  const supabase = await createClient();
  const pageSize = Math.min(24, Math.max(1, Math.trunc(query.pageSize ?? 6)));
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  if (!supabase) return emptyList(page, pageSize);

  const categories = query.category ? await getPublicCategories() : [];
  const tags = query.tag ? await getPublicTags() : [];
  const category = categories.find((item) => item.slug === query.category);
  const tag = tags.find((item) => item.slug === query.tag);
  if (query.category && !category) return emptyList(page, pageSize);
  if (query.tag && !tag) return emptyList(page, pageSize);

  let taggedPostIds: string[] | null = null;
  if (tag) {
    const { data, error } = await supabase
      .from("post_tags")
      .select("post_id")
      .eq("tag_id", tag.id);
    if (error) {
      await logDataError("blog_tag_posts", error.message);
      return emptyList(page, pageSize);
    }
    taggedPostIds = (data ?? []).map((row) => row.post_id);
    if (taggedPostIds.length === 0) return emptyList(page, pageSize);
  }

  let dbQuery = supabase
    .from("posts")
    .select("*", { count: "exact" })
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .is("deleted_at", null);

  if (query.q) {
    // PostgREST's `or` syntax uses commas/parentheses as separators.
    const safe = query.q
      .replace(/[(),\\]/g, " ")
      .trim()
      .slice(0, 80);
    if (safe) {
      dbQuery = dbQuery.or(
        `title.ilike.%${safe}%,excerpt.ilike.%${safe}%,content_md.ilike.%${safe}%`,
      );
    }
  }
  if (category) dbQuery = dbQuery.eq("category_id", category.id);
  if (taggedPostIds) dbQuery = dbQuery.in("id", taggedPostIds);

  const from = (page - 1) * pageSize;
  const { data, count, error } = await dbQuery
    .order("published_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) {
    await logDataError("published_posts", error.message);
    return emptyList(page, pageSize);
  }
  return { posts: (data ?? []) as Post[], total: count ?? 0, page, pageSize };
}

export async function getPublishedPostBySlug(
  slug: string,
): Promise<PostDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await publicPostFilter(
    supabase,
    "*, blog_categories(id, name, slug), post_tags(blog_tags(id, name, slug))",
  )
    .eq("slug", slug)
    .maybeSingle();
  if (error) await logDataError("published_post", error.message);
  return (data ?? null) as unknown as PostDetail | null;
}

export async function getPublishedSlugs(): Promise<string[]> {
  const env = getSupabaseEnv();
  if (!env) return [];

  // generateStaticParams runs at build time without an HTTP request, so it must
  // not use the cookie-backed server client. Published posts are readable by
  // anon through RLS, which is enough to discover build-time slugs.
  const supabase = createSupabaseClient<Database>(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("posts")
    .select("slug")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .is("deleted_at", null);
  if (error) {
    await logDataError("published_post_slugs", error.message);
    return [];
  }
  return (data ?? []).map((row) => row.slug);
}

export async function getPublicCategories(): Promise<BlogCategory[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("blog_categories")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    await logDataError("public_blog_categories", error.message);
    return [];
  }
  return (data ?? []) as BlogCategory[];
}

export async function getPublicTags(): Promise<BlogTag[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("blog_tags")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    await logDataError("public_blog_tags", error.message);
    return [];
  }
  return (data ?? []) as BlogTag[];
}

/** Tag links for a page of published posts; RLS hides links to drafts. */
export async function getPublicTagLinks(
  postIds: string[],
): Promise<Array<{ post_id: string; tag_id: string }>> {
  if (postIds.length === 0) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("post_tags")
    .select("post_id, tag_id")
    .in("post_id", postIds);
  if (error) {
    await logDataError("public_post_tag_links", error.message);
    return [];
  }
  return (data ?? []) as Array<{ post_id: string; tag_id: string }>;
}

export async function getRelatedPosts(
  post: PostDetail,
  limit = 3,
): Promise<Post[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await publicPostFilter(supabase)
    .order("published_at", { ascending: false })
    .limit(50);
  if (error) {
    await logDataError("related_posts", error.message);
    return [];
  }
  const posts = (data ?? []) as Post[];
  const tagIdsByPost: Record<string, string[]> = {};
  for (const candidate of posts) {
    tagIdsByPost[candidate.id] = [];
  }
  const { data: links, error: linkError } = await supabase
    .from("post_tags")
    .select("post_id, tag_id");
  if (!linkError) {
    for (const link of links ?? []) {
      (tagIdsByPost[link.post_id] ??= []).push(link.tag_id);
    }
  }
  return relatedPosts({
    posts,
    currentId: post.id,
    categoryId: post.category_id,
    tagIdsByPost,
    limit,
  });
}

export type OwnerBlog = {
  posts: Post[];
  categories: BlogCategory[];
  tags: BlogTag[];
};

export async function getOwnerBlog(ownerId: string): Promise<OwnerBlog> {
  const supabase = await createClient();
  const empty: OwnerBlog = { posts: [], categories: [], tags: [] };
  if (!supabase) return empty;

  const [posts, categories, tags] = await Promise.all([
    supabase
      .from("posts")
      .select("*")
      .eq("owner_id", ownerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("blog_categories")
      .select("*")
      .eq("owner_id", ownerId)
      .order("name", { ascending: true }),
    supabase
      .from("blog_tags")
      .select("*")
      .eq("owner_id", ownerId)
      .order("name", { ascending: true }),
  ]);

  if (posts.error) await logDataError("owner_posts", posts.error.message);
  if (categories.error)
    await logDataError("owner_blog_categories", categories.error.message);
  if (tags.error) await logDataError("owner_blog_tags", tags.error.message);

  return {
    posts: (posts.data ?? []) as Post[],
    categories: (categories.data ?? []) as BlogCategory[],
    tags: (tags.data ?? []) as BlogTag[],
  };
}

export async function getOwnerPost(
  ownerId: string,
  id: string,
): Promise<{ post: Post | null; tagIds: string[] }> {
  const supabase = await createClient();
  if (!supabase) return { post: null, tagIds: [] };
  const { data: post, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) await logDataError("owner_post", error.message);
  if (!post) return { post: null, tagIds: [] };

  const { data: links } = await supabase
    .from("post_tags")
    .select("tag_id")
    .eq("post_id", id);
  return {
    post: post as Post,
    tagIds: (links ?? []).map((row) => row.tag_id),
  };
}

export async function getPostTagIds(postId: string): Promise<string[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("post_tags")
    .select("tag_id")
    .eq("post_id", postId);
  if (error) {
    await logDataError("post_tag_ids", error.message);
    return [];
  }
  return (data ?? []).map((row) => row.tag_id);
}
