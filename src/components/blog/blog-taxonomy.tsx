"use client";

import { useActionState } from "react";
import {
  publishDuePostsAction,
  saveCategoryAction,
  saveTagAction,
} from "@/app/admin/(private)/blog/actions";
import { ModelForm, type FieldConfig } from "@/components/admin/model-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FormState } from "@/lib/validation/schemas";
import type { BlogCategory, BlogTag } from "../../../types/supabase";

const initial: FormState = { status: "idle" };

const categoryFields: FieldConfig[] = [
  { name: "name", label: "Name", required: true },
  {
    name: "slug",
    label: "Slug",
    hint: "Lowercase letters, numbers and hyphens",
    required: true,
  },
  { name: "description", label: "Description", type: "textarea", rows: 2 },
];

const tagFields: FieldConfig[] = [
  { name: "name", label: "Name", required: true },
  {
    name: "slug",
    label: "Slug",
    hint: "Lowercase letters, numbers and hyphens",
    required: true,
  },
];

function Result({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={
        state.status === "error"
          ? "text-danger text-sm"
          : "text-primary text-sm"
      }
    >
      {state.message}
    </p>
  );
}

export function PublishDueButton() {
  const [state, formAction, pending] = useActionState(
    publishDuePostsAction,
    initial,
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action={formAction}>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Publishing…" : "Publish due scheduled posts"}
        </Button>
      </form>
      <Result state={state} />
    </div>
  );
}

export function BlogTaxonomy({
  categories,
  tags,
}: {
  categories: BlogCategory[];
  tags: BlogTag[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>
            Categories{" "}
            <span className="text-muted-foreground text-sm font-normal">
              ({categories.length})
            </span>
          </CardTitle>
          <Badge>Optional grouping</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {categories.map((category) => (
            <details key={category.id} className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {category.name}{" "}
                <span className="text-muted-foreground font-normal">
                  /{category.slug}
                </span>
              </summary>
              <div className="pt-4">
                <ModelForm
                  action={saveCategoryAction}
                  fields={categoryFields}
                  initial={{
                    id: category.id,
                    name: category.name,
                    slug: category.slug,
                    description: category.description ?? "",
                  }}
                  submitLabel="Save category"
                />
              </div>
            </details>
          ))}
          <details className="rounded-lg border border-dashed p-3">
            <summary className="cursor-pointer text-sm font-medium">
              + Add category
            </summary>
            <div className="pt-4">
              <ModelForm
                action={saveCategoryAction}
                fields={categoryFields}
                submitLabel="Create category"
              />
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>
            Tags{" "}
            <span className="text-muted-foreground text-sm font-normal">
              ({tags.length})
            </span>
          </CardTitle>
          <Badge>Attached to posts</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {tags.map((tag) => (
            <details key={tag.id} className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {tag.name}{" "}
                <span className="text-muted-foreground font-normal">
                  /{tag.slug}
                </span>
              </summary>
              <div className="pt-4">
                <ModelForm
                  action={saveTagAction}
                  fields={tagFields}
                  initial={{ id: tag.id, name: tag.name, slug: tag.slug }}
                  submitLabel="Save tag"
                />
              </div>
            </details>
          ))}
          <details className="rounded-lg border border-dashed p-3">
            <summary className="cursor-pointer text-sm font-medium">
              + Add tag
            </summary>
            <div className="pt-4">
              <ModelForm
                action={saveTagAction}
                fields={tagFields}
                submitLabel="Create tag"
              />
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
