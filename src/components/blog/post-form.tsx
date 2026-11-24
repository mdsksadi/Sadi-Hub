"use client";

import { useActionState, useRef, useState } from "react";
import {
  savePostAction,
  uploadBlogImageAction,
} from "@/app/admin/(private)/blog/actions";
import { postStatusLabel } from "@/lib/domain/blog";
import type { FormState } from "@/lib/validation/schemas";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/field";
import type {
  BlogCategory,
  BlogTag,
  Post,
  PostStatus,
} from "../../../types/supabase";

type UploadState = FormState & { path?: string };

const saveInitial: FormState = { status: "idle" };
const uploadInitial: UploadState = { status: "idle" };
const statuses: PostStatus[] = ["draft", "scheduled", "published", "archived"];
const selectClass = "bg-background w-full rounded-md border px-3 py-2 text-sm";

/** datetime-local expects a wall-clock value, while the database stores UTC. */
function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function PostForm({
  post,
  categories,
  tags,
  tagIds = [],
}: {
  post?: Post | null;
  categories: BlogCategory[];
  tags: BlogTag[];
  tagIds?: string[];
}) {
  const [saveState, saveAction, savePending] = useActionState(
    savePostAction,
    saveInitial,
  );
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadBlogImageAction,
    uploadInitial,
  );
  const [content, setContent] = useState(post?.content_md ?? "");
  const coverRef = useRef<HTMLInputElement>(null);
  // An upload result wins over the stored path; the keys remount both inputs
  // when a new path arrives, so manual edits survive until the next upload.
  const coverPath = uploadState.path ?? post?.cover_path ?? "";

  const selectedTags = new Set(tagIds);

  return (
    <div className="space-y-8">
      <form action={saveAction} className="space-y-8">
        <input type="hidden" name="id" value={post?.id ?? ""} />
        <input
          key={coverPath}
          ref={coverRef}
          type="hidden"
          name="coverPath"
          defaultValue={coverPath}
        />

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={post?.title ?? ""}
              required
            />
          </div>
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              defaultValue={post?.slug ?? ""}
              required
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Lowercase letters, numbers and single hyphens.
            </p>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea
              id="excerpt"
              name="excerpt"
              rows={3}
              maxLength={300}
              defaultValue={post?.excerpt ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              className={selectClass}
              defaultValue={post?.status ?? "draft"}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {postStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="categoryId">Category</Label>
            <select
              id="categoryId"
              name="categoryId"
              className={selectClass}
              defaultValue={post?.category_id ?? ""}
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="publishedAt">Published at</Label>
            <Input
              id="publishedAt"
              name="publishedAt"
              type="datetime-local"
              defaultValue={toLocalInput(post?.published_at ?? null)}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Required when the status is Published.
            </p>
          </div>
          <div>
            <Label htmlFor="scheduledFor">Scheduled for</Label>
            <Input
              id="scheduledFor"
              name="scheduledFor"
              type="datetime-local"
              defaultValue={toLocalInput(post?.scheduled_for ?? null)}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Required when the status is Scheduled.
            </p>
          </div>
          <div>
            <Label htmlFor="coverPath">Cover image path</Label>
            <Input
              key={`cover-${coverPath}`}
              id="coverPath"
              defaultValue={coverPath}
              onChange={(event) => {
                if (coverRef.current)
                  coverRef.current.value = event.target.value;
              }}
              placeholder="blog/…"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Set by the upload below, or paste an existing storage path.
            </p>
          </div>
          <div>
            <Label htmlFor="seoTitle">SEO title</Label>
            <Input
              id="seoTitle"
              name="seoTitle"
              maxLength={200}
              defaultValue={post?.seo_title ?? ""}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="seoDescription">SEO description</Label>
            <Textarea
              id="seoDescription"
              name="seoDescription"
              rows={2}
              maxLength={300}
              defaultValue={post?.seo_description ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="tagIds">Tags</Label>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {tags.length === 0 && (
                <p className="text-muted-foreground text-xs">
                  No tags yet. Add them from the Blog page.
                </p>
              )}
              {tags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex items-center gap-2 text-sm font-normal"
                >
                  <input
                    type="checkbox"
                    name="tagIds"
                    value={tag.id}
                    defaultChecked={selectedTags.has(tag.id)}
                    className="h-4 w-4"
                  />
                  {tag.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isFeatured"
                defaultChecked={post?.is_featured ?? false}
                className="h-4 w-4"
              />
              Feature this post
            </label>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <Label htmlFor="contentMd">Content (Markdown)</Label>
            <Textarea
              id="contentMd"
              name="contentMd"
              rows={18}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-80 font-mono text-sm"
              placeholder="# Post title&#10;&#10;Write with **Markdown**."
            />
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-sm font-medium">
              Live preview
            </p>
            <div className="min-h-80 rounded-md border p-4">
              {content.trim() ? (
                <Markdown source={content} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Start writing to see the rendered post.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={savePending}>
            {savePending ? "Saving…" : "Save post"}
          </Button>
          {saveState.message && (
            <p
              role="status"
              className={
                saveState.status === "error"
                  ? "text-danger text-sm"
                  : "text-primary text-sm"
              }
            >
              {saveState.message}
            </p>
          )}
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Cover image upload</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={uploadAction} className="max-w-md space-y-3">
            <Label htmlFor="coverImage">Image file</Label>
            <Input
              id="coverImage"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
              required
            />
            <Button type="submit" variant="outline" disabled={uploadPending}>
              {uploadPending ? "Uploading…" : "Upload image"}
            </Button>
            {uploadState.message && (
              <p
                role="status"
                className={
                  uploadState.status === "error"
                    ? "text-danger text-sm"
                    : "text-primary text-sm"
                }
              >
                {uploadState.message}
              </p>
            )}
            {uploadState.path && (
              <p className="text-muted-foreground text-xs">
                Saved to <code className="break-all">{uploadState.path}</code>
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
