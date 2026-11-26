import type { MetadataRoute } from "next";
import { getPublishedSlugs } from "@/lib/data/blog";
import { getPublicProjects } from "@/lib/data/portfolio";
import { absoluteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    "/",
    "/blog",
    "/about",
    "/experience",
    "/education",
    "/skills",
    "/projects",
    "/resume",
    "/contact",
  ];
  const [projects, postSlugs] = await Promise.all([
    getPublicProjects(),
    getPublishedSlugs(),
  ]);

  return [
    ...staticPaths.map((path) => ({
      url: absoluteUrl(path),
      lastModified: new Date(),
      changeFrequency: (path === "/blog" ? "weekly" : "monthly") as
        "weekly" | "monthly",
      priority: path === "/" ? 1 : 0.7,
    })),
    ...projects.map((project) => ({
      url: absoluteUrl(`/projects/${project.slug}`),
      lastModified: new Date(project.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...postSlugs.map((slug) => ({
      url: absoluteUrl(`/blog/${slug}`),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
