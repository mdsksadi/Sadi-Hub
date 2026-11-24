import type { Metadata } from "next";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicProfile, getResumeObjectPath } from "@/lib/data/portfolio";
import { formatDate } from "@/lib/utils";

export const revalidate = 300;
export const metadata: Metadata = { title: "Resume" };

export default async function ResumePage() {
  const [profile, resumePath] = await Promise.all([
    getPublicProfile(),
    getResumeObjectPath(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Resume</h1>
        <p className="text-muted-foreground mt-2">
          A PDF copy of the current resume.
        </p>
      </header>
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
    </div>
  );
}
