import type { Metadata } from "next";
import Link from "next/link";
import {
  BlogTaxonomy,
  PublishDueButton,
} from "@/components/blog/blog-taxonomy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth/owner";
import { getOwnerBlog } from "@/lib/data/blog";
import { formatReadingTime, postStatusLabel } from "@/lib/domain/blog";
import type { PostStatus } from "../../../../../types/supabase";
import { deletePostAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Blog",
  robots: { index: false },
};

function statusClass(status: PostStatus): string {
  switch (status) {
    case "published":
      return "bg-primary/10 text-primary";
    case "scheduled":
      return "bg-amber-500/10 text-amber-600";
    case "archived":
      return "bg-muted text-muted-foreground line-through";
    default:
      return "";
  }
}

function displayDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export default async function AdminBlogPage() {
  const owner = await requireOwner();
  const { posts, categories, tags } = await getOwnerBlog(owner.userId);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
        <p className="text-muted-foreground mt-2">
          Write in Markdown, schedule releases and organise posts with
          categories and tags. Drafts stay private.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link href="/admin/blog/new">New post</Link>
        </Button>
        <PublishDueButton />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>
            Posts{" "}
            <span className="text-muted-foreground text-sm font-normal">
              ({posts.length})
            </span>
          </CardTitle>
          <Badge>Owner only</Badge>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No posts yet. Use “New post” to write the first one.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-xs tracking-wide uppercase">
                    <th className="py-2 pr-4 font-medium">Title</th>
                    <th className="py-2 pr-4 font-medium">Slug</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">
                      Published / scheduled
                    </th>
                    <th className="py-2 pr-4 font-medium">Flags</th>
                    <th className="py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{post.title}</td>
                      <td className="text-muted-foreground py-3 pr-4 font-mono text-xs">
                        /{post.slug}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge className={statusClass(post.status)}>
                          {postStatusLabel(post.status)}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground py-3 pr-4 text-xs">
                        {displayDate(post.published_at ?? post.scheduled_for)}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {post.is_featured && <Badge>Featured</Badge>}
                          <Badge>
                            {formatReadingTime(post.reading_minutes)}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/blog/${post.id}/edit`}>
                              Edit
                            </Link>
                          </Button>
                          <form action={deletePostAction}>
                            <input type="hidden" name="id" value={post.id} />
                            <Button type="submit" variant="danger" size="sm">
                              Archive
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <BlogTaxonomy categories={categories} tags={tags} />
    </div>
  );
}
