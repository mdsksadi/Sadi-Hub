import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicProjectBySlug } from "@/lib/data/portfolio";
import { absoluteUrl } from "@/lib/env";
import { jsonLd } from "@/lib/domain/json";
import { publicObjectUrl, PUBLIC_BUCKET } from "@/lib/supabase/storage";
import { formatDateRange, safeExternalUrl } from "@/lib/utils";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublicProjectBySlug(slug);
  if (!project) return { title: "Project not found" };
  return {
    title: project.title,
    description: project.short_description ?? undefined,
    alternates: { canonical: absoluteUrl(`/projects/${project.slug}`) },
    openGraph: {
      title: project.title,
      description: project.short_description ?? undefined,
      url: absoluteUrl(`/projects/${project.slug}`),
      images: project.image_path
        ? [publicObjectUrl(PUBLIC_BUCKET, project.image_path)!]
        : undefined,
    },
  };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const project = await getPublicProjectBySlug(slug);
  if (!project) notFound();

  const github = safeExternalUrl(project.github_url);
  const demo = safeExternalUrl(project.demo_url);
  const image = publicObjectUrl(PUBLIC_BUCKET, project.image_path);

  return (
    <article className="space-y-8">
      <Link href="/projects" className="text-primary text-sm hover:underline">
        ← All projects
      </Link>
      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {project.title}
        </h1>
        {project.short_description && (
          <p className="text-muted-foreground text-lg">
            {project.short_description}
          </p>
        )}
        <p className="text-muted-foreground text-sm">
          {formatDateRange(project.start_date, project.completion_date)}
        </p>
        <div className="flex flex-wrap gap-2">
          {project.tech_stack.map((tech) => (
            <Badge key={tech}>{tech}</Badge>
          ))}
        </div>
      </header>

      {image && (
        <Image
          src={image}
          alt={project.title}
          width={1200}
          height={600}
          unoptimized
          className="w-full rounded-xl border object-cover"
          priority
        />
      )}

      <Markdown source={project.description_md} className="max-w-3xl" />

      {(github || demo) && (
        <div className="flex flex-wrap gap-3">
          {github && (
            <Button asChild variant="outline">
              <a href={github} target="_blank" rel="noopener noreferrer">
                Source code
              </a>
            </Button>
          )}
          {demo && (
            <Button asChild>
              <a href={demo} target="_blank" rel="noopener noreferrer">
                Live demo
              </a>
            </Button>
          )}
        </div>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            name: project.title,
            description: project.short_description,
            dateCreated: project.start_date,
            url: absoluteUrl(`/projects/${project.slug}`),
          }),
        }}
      />
    </article>
  );
}
