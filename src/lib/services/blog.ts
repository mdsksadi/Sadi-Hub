import { storagePathFor, PUBLIC_BUCKET } from "@/lib/supabase/storage";
import { createClient } from "@/lib/supabase/server";
import type {
  BlogCategoryInput,
  BlogTagInput,
  PostInput,
} from "@/lib/validation/schemas";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/svg+xml",
]);

function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function requireClient() {
  // Resolved inside each function so Server Actions get mutable cookies.
  return createClient(true);
}

export type SavedPost = { id: string; slug: string };

export async function savePost(
  ownerId: string,
  input: PostInput,
): Promise<SavedPost> {
  const supabase = await requireClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const row = {
    author_id: ownerId,
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt || null,
    content_md: input.contentMd,
    title_en: input.titleEn || null,
    excerpt_en: input.excerptEn || null,
    content_md_en: input.contentMdEn || null,
    cover_path: input.coverPath || null,
    category_id: input.categoryId || null,
    status: input.status,
    published_at:
      input.status === "published" ? toIso(input.publishedAt) : null,
    scheduled_for:
      input.status === "scheduled" ? toIso(input.scheduledFor) : null,
    seo_title: input.seoTitle || null,
    seo_description: input.seoDescription || null,
    is_featured: input.isFeatured,
  };

  let id = input.id;
  if (id) {
    const { error } = await supabase
      .from("posts")
      .update(row)
      .eq("id", id)
      .eq("owner_id", ownerId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("posts")
      .insert({ ...row, owner_id: ownerId })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id;
  }

  const { error: deleteError } = await supabase
    .from("post_tags")
    .delete()
    .eq("post_id", id);
  if (deleteError) throw deleteError;

  if (input.tagIds.length > 0) {
    const { error: tagError } = await supabase
      .from("post_tags")
      .insert(input.tagIds.map((tagId) => ({ post_id: id, tag_id: tagId })));
    if (tagError) throw tagError;
  }

  return { id, slug: input.slug };
}

export async function softDeletePost(
  ownerId: string,
  id: string,
): Promise<void> {
  const supabase = await requireClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase
    .from("posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", ownerId);
  if (error) throw error;
}

export async function saveBlogCategory(
  ownerId: string,
  input: BlogCategoryInput,
): Promise<void> {
  const supabase = await requireClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const row = {
    name: input.name,
    slug: input.slug,
    description: input.description || null,
  };
  const result = input.id
    ? await supabase
        .from("blog_categories")
        .update(row)
        .eq("id", input.id)
        .eq("owner_id", ownerId)
    : await supabase
        .from("blog_categories")
        .insert({ ...row, owner_id: ownerId });
  if (result.error) throw result.error;
}

export async function saveBlogTag(
  ownerId: string,
  input: BlogTagInput,
): Promise<void> {
  const supabase = await requireClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const row = { name: input.name, slug: input.slug };
  const result = input.id
    ? await supabase
        .from("blog_tags")
        .update(row)
        .eq("id", input.id)
        .eq("owner_id", ownerId)
    : await supabase.from("blog_tags").insert({ ...row, owner_id: ownerId });
  if (result.error) throw result.error;
}

export async function publishDuePosts(): Promise<number> {
  const supabase = await requireClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("publish_scheduled_posts");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function uploadBlogImage(
  ownerId: string,
  file: File,
): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Use a JPEG, PNG, WebP, AVIF or SVG image.");
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error("Images must be smaller than 5 MB.");
  }
  const supabase = await requireClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const path = `blog/${storagePathFor(ownerId, file.name)}`;
  const { error } = await supabase.storage
    .from(PUBLIC_BUCKET)
    .upload(path, new Uint8Array(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
  if (error) throw error;
  return path;
}
