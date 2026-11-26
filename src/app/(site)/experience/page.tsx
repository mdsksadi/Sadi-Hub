import type { Metadata } from "next";
import {
  ExperienceList,
  PortfolioSection,
} from "@/components/portfolio-sections";
import { getPublicExperiences } from "@/lib/data/portfolio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Experience" };

export default async function ExperiencePage() {
  const experiences = await getPublicExperiences();

  return (
    <PortfolioSection
      id="experience"
      title="Experience"
      description="Roles, responsibilities and technologies."
      asPageTitle
    >
      <ExperienceList experiences={experiences} />
    </PortfolioSection>
  );
}
