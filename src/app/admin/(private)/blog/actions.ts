"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/owner";
import {
  publishDuePosts,
  saveBlogCategory,
  saveBlogTag,
  savePost,
  softDeletePost,
  uploadBlogImage,
} from "@/lib/services/blog";
import {
  formBoolean,
  formDateTime,
  formId,
  formIds,
  formText,
} from "@/lib/validation/forms";
import {
  blogCategorySchema,
  blogTagSchema,
  postSchema,
  type FormState,
} from "@/lib/validation/schemas";

/** Upload state is local to this module's action and mirrored by PostForm. */
type UploadImageState = FormState & { path?: string };

function refreshBlog(slug?: string | null): void {
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  revalidatePath("/blog/[slug]", "page");
  if (slug) revalidatePath(`/blog/${slug}`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/rss.xml");
}

function failure(message: string): FormState {
  return { status: "error", message };
}

function success(message: string, slug?: string | null): FormState {
  refreshBlog(slug);
  return { status: "success", message };
}

function invalidFields(message: string, detail?: string): FormState {
  return failure(detail ? `${message}: ${detail}` : message);
}

export async function savePostAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = postSchema.safeParse({
    id: formId(formData),
    title: formText(formData, "title"),
    slug: formText(formData, "slug"),
    excerpt: formText(formData, "excerpt"),
    contentMd: formText(formData, "contentMd"),
    coverPath: formText(formData, "coverPath"),
    status: formText(formData, "status"),
    publishedAt: formDateTime(formData, "publishedAt"),
    scheduledFor: formDateTime(formData, "scheduledFor"),
    seoTitle: formText(formData, "seoTitle"),
    seoDescription: formText(formData, "seoDescription"),
    isFeatured: formBoolean(formData, "isFeatured"),
    categoryId: formText(formData, "categoryId"),
    tagIds: formIds(formData, "tagIds"),
  });
  if (!parsed.success) {
    return invalidFields(
      "Check the post fields",
      parsed.error.issues[0]?.message,
    );
  }

  try {
    const saved = await savePost(owner.userId, parsed.data);
    return success("Post saved.", saved.slug);
  } catch {
    return failure("Could not save the post. Check the slug and try again.");
  }
}

export async function deletePostAction(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const parsed = z.string().uuid().safeParse(formId(formData));
  if (!parsed.success) return;

  await softDeletePost(owner.userId, parsed.data);
  refreshBlog();
}

export async function publishDuePostsAction(
  state: FormState,
): Promise<FormState> {
  await requireOwner();
  try {
    const count = await publishDuePosts();
    return success(
      count === 0
        ? "No scheduled posts were due."
        : `Published ${count} scheduled ${count === 1 ? "post" : "posts"}.`,
    );
  } catch {
    return { ...state, ...failure("Could not publish scheduled posts.") };
  }
}

export async function saveCategoryAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = blogCategorySchema.safeParse({
    id: formId(formData),
    name: formText(formData, "name"),
    slug: formText(formData, "slug"),
    description: formText(formData, "description"),
  });
  if (!parsed.success) {
    return invalidFields(
      "Check the category fields",
      parsed.error.issues[0]?.message,
    );
  }

  try {
    await saveBlogCategory(owner.userId, parsed.data);
  } catch {
    return failure(
      "Could not save the category. Check the slug and try again.",
    );
  }
  return success("Category saved.");
}

export async function saveTagAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = blogTagSchema.safeParse({
    id: formId(formData),
    name: formText(formData, "name"),
    slug: formText(formData, "slug"),
  });
  if (!parsed.success) {
    return invalidFields(
      "Check the tag fields",
      parsed.error.issues[0]?.message,
    );
  }

  try {
    await saveBlogTag(owner.userId, parsed.data);
  } catch {
    return failure("Could not save the tag. Check the slug and try again.");
  }
  return success("Tag saved.");
}

export async function uploadBlogImageAction(
  _state: UploadImageState,
  formData: FormData,
): Promise<UploadImageState> {
  const owner = await requireOwner();
  const parsed = z
    .object({
      image: z.custom<File>(
        (value) => value instanceof File && value.size > 0,
        "Choose an image.",
      ),
    })
    .safeParse({ image: formData.get("image") });
  if (!parsed.success) return failure("Choose an image.");

  try {
    const path = await uploadBlogImage(owner.userId, parsed.data.image);
    return { status: "success", message: "Image uploaded.", path };
  } catch {
    return failure("Could not upload the image. Use an image under 5 MB.");
  }
}
