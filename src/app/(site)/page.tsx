import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPublicExperiences,
  getPublicProfile,
  getPublicProjects,
  getPublicSkills,
} from "@/lib/data/portfolio";
import { publicObjectUrl, PUBLIC_BUCKET } from "@/lib/supabase/storage";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [profile, projects, experiences, skills] = await Promise.all([
    getPublicProfile(),
    getPublicProjects(true),
    getPublicExperiences(),
    getPublicSkills(),
  ]);
  const avatar = publicObjectUrl(PUBLIC_BUCKET, profile?.avatar_path ?? null);

  return (
    <div className="space-y-14">
      <section className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-primary mb-2 text-sm font-medium tracking-widest uppercase">
            Welcome
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {profile?.display_name ?? "Sadi"}
          </h1>
          <p className="text-muted-foreground mt-3 text-xl">
            {profile?.headline ?? "Building useful things with software."}
          </p>
          {profile?.location && (
            <p className="text-muted-foreground mt-2 text-sm">
              {profile.location}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/about#projects">View projects</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact">Get in touch</Link>
            </Button>
          </div>
        </div>
        {avatar && (
          <Image
            src={avatar}
            alt={`${profile?.display_name ?? "Sadi"}'s avatar`}
            width={160}
            height={160}
            unoptimized
            className="ring-border h-40 w-40 rounded-full object-cover ring-2"
          />
        )}
      </section>

      <section aria-labelledby="featured-projects">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="featured-projects" className="text-2xl font-semibold">
            Featured projects
          </h2>
          <Link
            href="/about#projects"
            className="text-primary text-sm hover:underline"
          >
            All projects →
          </Link>
        </div>
        {projects.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8">
              No published projects yet. Content appears here once the owner
              publishes it.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
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
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-muted-foreground text-sm">
                    {project.short_description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {project.tech_stack.slice(0, 5).map((tech) => (
                      <Badge key={tech}>{tech}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section
        className="grid gap-6 md:grid-cols-2"
        aria-label="Background highlights"
      >
        <Card>
          <CardHeader>
            <CardTitle>Currently</CardTitle>
          </CardHeader>
          <CardContent>
            {experiences[0] ? (
              <div className="space-y-1">
                <p className="font-medium">{experiences[0].position}</p>
                <p className="text-muted-foreground text-sm">
                  {experiences[0].company}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No experience published yet.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top skills</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {skills.slice(0, 8).map((skill) => (
              <Badge key={skill.id}>{skill.name}</Badge>
            ))}
            {skills.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No skills published yet.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
