import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostForm } from "@/components/blog/post-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth/owner";
import { getOwnerBlog, getOwnerPost } from "@/lib/data/blog";
import { postStatusLabel } from "@/lib/domain/blog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit post",
  robots: { index: false },
};

export default async function AdminBlogEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const owner = await requireOwner();
  const { id } = await params;
  const [{ post, tagIds }, blog] = await Promise.all([
    getOwnerPost(owner.userId, id),
    getOwnerBlog(owner.userId),
  ]);
  if (!post) notFound();

  return (
    <div className="space-y-6">
      <header>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/blog">← Back to blog</Link>
        </Button>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Edit post</h1>
        <p className="text-muted-foreground mt-2">
          {post.title} · {postStatusLabel(post.status)}
        </p>
      </header>
      <Card>
        <CardContent>
          <PostForm
            post={post}
            categories={blog.categories}
            tags={blog.tags}
            tagIds={tagIds}
          />
        </CardContent>
      </Card>
    </div>
  );
}
