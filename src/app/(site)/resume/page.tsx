import type { Metadata } from "next";
import { PortfolioSection, ResumeCard } from "@/components/portfolio-sections";
import { getPublicProfile, getResumeObjectPath } from "@/lib/data/portfolio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Resume" };

export default async function ResumePage() {
  const [profile, resumePath] = await Promise.all([
    getPublicProfile(),
    getResumeObjectPath(),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PortfolioSection
        id="resume"
        title="Resume"
        description="A PDF copy of the current resume."
        asPageTitle
      >
        <ResumeCard profile={profile} resumePath={resumePath} />
      </PortfolioSection>
    </div>
  );
}
