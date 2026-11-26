import { Download } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { groupBy } from "@/lib/domain/portfolio";
import { publicObjectUrl, PUBLIC_BUCKET } from "@/lib/supabase/storage";
import { formatDate, formatDateRange } from "@/lib/utils";
import type {
  Certification,
  Education,
  Experience,
  PortfolioProject,
  PublicProfile,
  Skill,
} from "../../types/supabase";

type SectionProps = {
  id: string;
  title: string;
  description?: string;
  asPageTitle?: boolean;
  action?: ReactNode;
  children: ReactNode;
};

/** Shared About-hub section shell; standalone pages use `asPageTitle`. */
export function PortfolioSection({
  id,
  title,
  description,
  asPageTitle = false,
  action,
  children,
}: SectionProps) {
  const headingId = `${id}-heading`;
  const Heading = asPageTitle ? "h1" : "h2";

  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-20">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Heading
            id={headingId}
            className={
              asPageTitle
                ? "text-3xl font-bold tracking-tight"
                : "text-2xl font-semibold"
            }
          >
            {title}
          </Heading>
          {description && (
            <p className="text-muted-foreground mt-2 text-sm">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ProfileCard({ profile }: { profile: PublicProfile | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{profile?.display_name ?? "Sadi"}</CardTitle>
        {profile?.headline && (
          <p className="text-muted-foreground text-sm">{profile.headline}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {(profile?.location || profile?.timezone) && (
          <p className="text-muted-foreground text-sm">
            {[profile.location, profile.timezone].filter(Boolean).join(" · ")}
          </p>
        )}
        <Markdown source={profile?.bio_md} />
        {!profile && (
          <p className="text-muted-foreground text-sm">
            Profile content has not been configured yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function ExperienceList({ experiences }: { experiences: Experience[] }) {
  if (experiences.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No experience published yet.
      </p>
    );
  }

  return (
    <ol className="space-y-5 border-l pl-6">
      {experiences.map((item) => (
        <li key={item.id} className="relative">
          <span className="bg-primary absolute top-2 -left-[1.9rem] h-3 w-3 rounded-full" />
          <Card>
            <CardHeader>
              <CardTitle>{item.position}</CardTitle>
              <p className="text-muted-foreground text-sm">{item.company}</p>
              <p className="text-muted-foreground text-xs">
                {formatDateRange(
                  item.start_date,
                  item.end_date,
                  item.is_current,
                )}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {item.responsibilities.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {item.responsibilities.map((task) => (
                    <li key={task}>{task}</li>
                  ))}
                </ul>
              )}
              {item.technologies.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.technologies.map((tech) => (
                    <Badge key={tech}>{tech}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ol>
  );
}

export function EducationList({ items }: { items: Education[] }) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No education published yet.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <CardTitle>
              {item.degree}
              {item.field_of_study ? ` in ${item.field_of_study}` : ""}
            </CardTitle>
            <p className="text-muted-foreground text-sm">{item.institution}</p>
            <p className="text-muted-foreground text-xs">
              {formatDateRange(item.start_date, item.end_date)}
            </p>
          </CardHeader>
          {item.description_md && (
            <CardContent>
              <Markdown source={item.description_md} />
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

export function SkillGroups({ skills }: { skills: Skill[] }) {
  if (skills.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No skills published yet.</p>
    );
  }

  const groups = groupBy(skills, (skill) => skill.category);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Object.entries(groups).map(([category, items]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>{category}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {items.map((skill) => (
              <Badge
                key={skill.id}
                title={
                  skill.proficiency
                    ? `Proficiency ${skill.proficiency}/5`
                    : undefined
                }
              >
                {skill.name}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ProjectGrid({ projects }: { projects: PortfolioProject[] }) {
  if (projects.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No published projects yet.
      </p>
    );
  }

  return (
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
            {project.is_featured && <Badge className="w-fit">Featured</Badge>}
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
  );
}

export function ResumeCard({
  profile,
  resumePath,
}: {
  profile: PublicProfile | null;
  resumePath: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{profile?.display_name ?? "Sadi"} — Resume</CardTitle>
        {profile?.resume_updated_at && (
          <p className="text-muted-foreground text-sm">
            Updated {formatDate(profile.resume_updated_at.slice(0, 10))}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          The file is streamed through this site from private storage; the
          storage URL is not exposed.
        </p>
        <Button asChild>
          <a href="/api/resume">
            <Download className="h-4 w-4" /> View or download PDF
          </a>
        </Button>
        {!resumePath && (
          <p className="text-danger text-sm">
            No resume has been uploaded yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function CertificationList({
  certifications,
}: {
  certifications: Certification[];
}) {
  if (certifications.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No certifications published yet.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {certifications.map((cert) => (
        <li key={cert.id}>
          <Card className="h-full">
            <CardContent className="space-y-2 pt-5">
              <p className="font-medium">{cert.name}</p>
              <p className="text-muted-foreground text-sm">{cert.issuer}</p>
              <div className="flex flex-wrap items-center gap-2">
                {cert.issued_on && (
                  <Badge>Issued {formatDate(cert.issued_on)}</Badge>
                )}
                {cert.expires_on && (
                  <Badge>Expires {formatDate(cert.expires_on)}</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
