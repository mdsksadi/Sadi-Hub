import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPublishedPostBySlug,
  getPublishedSlugs,
  getRelatedPosts,
} from "@/lib/data/blog";
import { excerptFromMarkdown, formatReadingTime } from "@/lib/domain/blog";
import { jsonLd } from "@/lib/domain/json";
import { absoluteUrl } from "@/lib/env";
import { PUBLIC_BUCKET, publicObjectUrl } from "@/lib/supabase/storage";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return { title: "Post not found" };

  const url = absoluteUrl(`/blog/${slug}`);
  const title = post.seo_title || post.title;
  const description =
    post.seo_description ||
    post.excerpt ||
    excerptFromMarkdown(post.content_md) ||
    undefined;
  const cover = publicObjectUrl(PUBLIC_BUCKET, post.cover_path);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      publishedTime: post.published_at ?? undefined,
      images: cover ? [cover] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  const related = await getRelatedPosts(post);
  const cover = publicObjectUrl(PUBLIC_BUCKET, post.cover_path);
  const description =
    post.seo_description ||
    post.excerpt ||
    excerptFromMarkdown(post.content_md);
  const tags = post.post_tags
    .map((link) => link.blog_tags)
    .filter((tag): tag is NonNullable<typeof tag> => tag !== null);
  const published = formatDate(post.published_at);
  const url = absoluteUrl(`/blog/${slug}`);

  return (
    <article className="space-y-8">
      <Link href="/blog" className="text-primary text-sm hover:underline">
        ← All posts
      </Link>

      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {post.title}
        </h1>
        {description && (
          <p className="text-muted-foreground text-lg">{description}</p>
        )}
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {published && (
            <time dateTime={post.published_at ?? undefined}>{published}</time>
          )}
          <span aria-hidden="true">·</span>
          <span>{formatReadingTime(post.reading_minutes)}</span>
        </div>
        {(post.blog_categories || tags.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {post.blog_categories && (
              <Link
                href={`/blog?category=${encodeURIComponent(post.blog_categories.slug)}`}
              >
                <Badge>{post.blog_categories.name}</Badge>
              </Link>
            )}
            {tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/blog?tag=${encodeURIComponent(tag.slug)}`}
              >
                <Badge>{tag.name}</Badge>
              </Link>
            ))}
          </div>
        )}
      </header>

      {cover && (
        <Image
          src={cover}
          alt={post.title}
          width={1200}
          height={600}
          unoptimized
          className="w-full rounded-xl border object-cover"
          priority
        />
      )}

      <Markdown source={post.content_md} className="max-w-3xl" />

      {related.length > 0 && (
        <section className="space-y-4 border-t pt-8">
          <h2 className="text-xl font-semibold">Related posts</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {related.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle>
                    <Link
                      href={`/blog/${item.slug}`}
                      className="hover:underline"
                    >
                      {item.title}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground line-clamp-3 text-sm">
                    {item.excerpt || excerptFromMarkdown(item.content_md)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description,
            datePublished: post.published_at,
            dateModified: post.updated_at,
            url,
            image: cover ?? undefined,
          }),
        }}
      />
    </article>
  );
}
