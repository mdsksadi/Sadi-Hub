import { getPublishedPosts } from "@/lib/data/blog";
import { excerptFromMarkdown } from "@/lib/domain/blog";
import { absoluteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

const XML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => XML_ENTITIES[character]);
}

function rfc822Date(value: string | null | undefined): string {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime())
    ? new Date().toUTCString()
    : date.toUTCString();
}

export async function GET() {
  const { posts } = await getPublishedPosts({ pageSize: 24 });
  const blogUrl = absoluteUrl("/blog");

  const items = posts
    .map((post) => {
      const url = absoluteUrl(`/blog/${post.slug}`);
      const description = post.excerpt || excerptFromMarkdown(post.content_md);
      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <description>${escapeXml(description)}</description>`,
        `      <pubDate>${rfc822Date(post.published_at ?? post.created_at)}</pubDate>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    "    <title>Sadi Hub Blog</title>",
    `    <link>${escapeXml(blogUrl)}</link>`,
    "    <description>Recent writing from Sadi Hub.</description>",
    "    <language>en-us</language>",
    `    <lastBuildDate>${rfc822Date(null)}</lastBuildDate>`,
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
