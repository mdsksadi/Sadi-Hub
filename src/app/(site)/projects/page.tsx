import type { Metadata } from "next";
import { PortfolioSection, ProjectGrid } from "@/components/portfolio-sections";
import { getPublicProjects } from "@/lib/data/portfolio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const projects = await getPublicProjects();

  return (
    <PortfolioSection
      id="projects"
      title="Projects"
      description="Selected work and experiments."
      asPageTitle
    >
      <ProjectGrid projects={projects} />
    </PortfolioSection>
  );
}
