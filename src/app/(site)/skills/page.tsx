import type { Metadata } from "next";
import { PortfolioSection, SkillGroups } from "@/components/portfolio-sections";
import { getPublicSkills } from "@/lib/data/portfolio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Skills" };

export default async function SkillsPage() {
  const skills = await getPublicSkills();

  return (
    <PortfolioSection
      id="skills"
      title="Skills"
      description="Tools and technologies I work with."
      asPageTitle
    >
      <SkillGroups skills={skills} />
    </PortfolioSection>
  );
}
