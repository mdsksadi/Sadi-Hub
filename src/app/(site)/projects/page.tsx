import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicProjects } from "@/lib/data/portfolio";
import { publicObjectUrl, PUBLIC_BUCKET } from "@/lib/supabase/storage";

export const revalidate = 300;
export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const projects = await getPublicProjects();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground mt-2">
          Selected work and experiments.
        </p>
      </header>

      {projects.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No published projects yet.
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {projects.map((project) => (
            <Card key={project.id} className="overflow-hidden">
              {project.image_path && (
                <Image
                  src={publicObjectUrl(PUBLIC_BUCKET, project.image_path)!}
                  alt=""
                  width={640}
                  height={320}
                  unoptimized
                  className="h-44 w-full object-cover"
                />
              )}
              <CardHeader>
                <CardTitle>
                  <Link
                    href={`/projects/${project.slug}`}
                    className="hover:underline"
                  >
                    {project.title}
                  </Link>
                </CardTitle>
                {project.is_featured && (
                  <Badge className="w-fit">Featured</Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-muted-foreground text-sm">
                  {project.short_description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {project.tech_stack.map((tech) => (
                    <Badge key={tech}>{tech}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
