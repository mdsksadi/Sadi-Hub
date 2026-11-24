import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicExperiences } from "@/lib/data/portfolio";
import { formatDateRange } from "@/lib/utils";

export const revalidate = 300;
export const metadata: Metadata = { title: "Experience" };

export default async function ExperiencePage() {
  const experiences = await getPublicExperiences();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Experience</h1>
        <p className="text-muted-foreground mt-2">
          Roles, responsibilities and technologies.
        </p>
      </header>

      {experiences.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No experience published yet.
        </p>
      ) : (
        <ol className="space-y-5 border-l pl-6">
          {experiences.map((item) => (
            <li key={item.id} className="relative">
              <span className="bg-primary absolute top-2 -left-[1.9rem] h-3 w-3 rounded-full" />
              <Card>
                <CardHeader>
                  <CardTitle>{item.position}</CardTitle>
                  <p className="text-muted-foreground text-sm">
                    {item.company}
                  </p>
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
      )}
    </div>
  );
}
