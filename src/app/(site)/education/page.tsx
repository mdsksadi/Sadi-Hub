import type { Metadata } from "next";
import {
  EducationList,
  PortfolioSection,
} from "@/components/portfolio-sections";
import { getPublicEducation } from "@/lib/data/portfolio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Education" };

export default async function EducationPage() {
  const items = await getPublicEducation();

  return (
    <PortfolioSection
      id="education"
      title="Education"
      description="Academic background."
      asPageTitle
    >
      <EducationList items={items} />
    </PortfolioSection>
  );
}
