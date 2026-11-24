import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicSkills } from "@/lib/data/portfolio";
import { groupBy } from "@/lib/domain/portfolio";

export const revalidate = 300;
export const metadata: Metadata = { title: "Skills" };

export default async function SkillsPage() {
  const skills = await getPublicSkills();
  const groups = groupBy(skills, (skill) => skill.category);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Skills</h1>
        <p className="text-muted-foreground mt-2">
          Tools and technologies I work with.
        </p>
      </header>

      {skills.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No skills published yet.
        </p>
      ) : (
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
      )}
    </div>
  );
}
