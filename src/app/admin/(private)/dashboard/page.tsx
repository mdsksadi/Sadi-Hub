import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth/owner";
import { getOwnerPortfolio, getOwnerProfile } from "@/lib/data/portfolio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false },
};

export default async function AdminDashboardPage() {
  const owner = await requireOwner();
  const [profile, portfolio] = await Promise.all([
    getOwnerProfile(owner.userId),
    getOwnerPortfolio(owner.userId),
  ]);

  const stats = [
    {
      label: "Projects",
      value: portfolio.projects.length,
      href: "/admin/portfolio",
    },
    {
      label: "Experience",
      value: portfolio.experiences.length,
      href: "/admin/portfolio",
    },
    {
      label: "Education",
      value: portfolio.education.length,
      href: "/admin/portfolio",
    },
    {
      label: "Skills",
      value: portfolio.skills.length,
      href: "/admin/portfolio",
    },
    {
      label: "Certifications",
      value: portfolio.certifications.length,
      href: "/admin/portfolio",
    },
    {
      label: "Social links",
      value: portfolio.socialLinks.length,
      href: "/admin/portfolio",
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Signed in as {profile?.display_name ?? owner.displayName} (
          {owner.email}).
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:border-primary transition-colors">
              <CardHeader>
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{stat.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Next steps</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            Fill in your profile and upload a resume PDF from the Profile page.
          </p>
          <p>
            Add portfolio content from the Portfolio page. Drafts stay private.
          </p>
          <p>
            Enroll or verify your authenticator app under Settings &amp; MFA.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
