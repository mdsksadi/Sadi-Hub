import type { Metadata } from "next";
import Link from "next/link";
import { PostForm } from "@/components/blog/post-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth/owner";
import { getOwnerBlog } from "@/lib/data/blog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "New post",
  robots: { index: false },
};

export default async function AdminBlogNewPage() {
  const owner = await requireOwner();
  const { categories, tags } = await getOwnerBlog(owner.userId);

  return (
    <div className="space-y-6">
      <header>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/blog">← Back to blog</Link>
        </Button>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">New post</h1>
        <p className="text-muted-foreground mt-2">
          Write in Markdown; the preview updates as you type.
        </p>
      </header>
      <Card>
        <CardContent>
          <PostForm categories={categories} tags={tags} />
        </CardContent>
      </Card>
    </div>
  );
}
