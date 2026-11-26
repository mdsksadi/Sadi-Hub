import type { Metadata } from "next";
import Link from "next/link";
import {
  CertificationList,
  EducationList,
  ExperienceList,
  PortfolioSection,
  ProfileCard,
  ProjectGrid,
  ResumeCard,
  SkillGroups,
} from "@/components/portfolio-sections";
import {
  getPublicCertifications,
  getPublicEducation,
  getPublicExperiences,
  getPublicProfile,
  getPublicProjects,
  getPublicSkills,
  getResumeObjectPath,
} from "@/lib/data/portfolio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "About" };

const sections = [
  { id: "experience", label: "Experience", href: "/experience" },
  { id: "education", label: "Education", href: "/education" },
  { id: "skills", label: "Skills", href: "/skills" },
  { id: "projects", label: "Projects", href: "/projects" },
  { id: "resume", label: "Resume", href: "/resume" },
];

function FullPageLink({ href }: { href: string }) {
  return (
    <Link href={href} className="text-primary text-sm hover:underline">
      Full page →
    </Link>
  );
}

export default async function AboutPage() {
  const [
    profile,
    experiences,
    education,
    skills,
    projects,
    certifications,
    resumePath,
  ] = await Promise.all([
    getPublicProfile(),
    getPublicExperiences(),
    getPublicEducation(),
    getPublicSkills(),
    getPublicProjects(),
    getPublicCertifications(),
    getResumeObjectPath(),
  ]);

  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">About</h1>
        <p className="text-muted-foreground mt-2">
          My portfolio at a glance: experience, education, skills, projects and
          resume.
        </p>
      </header>

      <ProfileCard profile={profile} />

      <nav
        aria-label="Portfolio sections"
        className="bg-card/80 rounded-xl border px-4 py-3"
      >
        <p className="text-muted-foreground mb-2 text-xs tracking-widest uppercase">
          On this page
        </p>
        <ul className="flex flex-wrap gap-2 text-sm">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="hover:bg-muted rounded-md px-2.5 py-1.5"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <PortfolioSection
        id="experience"
        title="Experience"
        description="Roles, responsibilities and technologies."
        action={<FullPageLink href="/experience" />}
      >
        <ExperienceList experiences={experiences} />
      </PortfolioSection>

      <PortfolioSection
        id="education"
        title="Education"
        description="Academic background."
        action={<FullPageLink href="/education" />}
      >
        <EducationList items={education} />
      </PortfolioSection>

      <PortfolioSection
        id="skills"
        title="Skills"
        description="Tools and technologies I work with."
        action={<FullPageLink href="/skills" />}
      >
        <SkillGroups skills={skills} />
      </PortfolioSection>

      <PortfolioSection
        id="projects"
        title="Projects"
        description="Selected work and experiments."
        action={<FullPageLink href="/projects" />}
      >
        <ProjectGrid projects={projects} />
      </PortfolioSection>

      <PortfolioSection
        id="resume"
        title="Resume"
        description="A PDF copy of the current resume."
        action={<FullPageLink href="/resume" />}
      >
        <div className="mx-auto max-w-2xl">
          <ResumeCard profile={profile} resumePath={resumePath} />
        </div>
      </PortfolioSection>

      <PortfolioSection
        id="certifications"
        title="Certifications"
        description="Credentials behind the work."
      >
        <CertificationList certifications={certifications} />
      </PortfolioSection>
    </div>
  );
}
