import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPublicCertifications,
  getPublicProfile,
} from "@/lib/data/portfolio";
import { formatDate } from "@/lib/utils";

export const revalidate = 300;
export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const [profile, certifications] = await Promise.all([
    getPublicProfile(),
    getPublicCertifications(),
  ]);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">About</h1>
        <p className="text-muted-foreground mt-2">
          A short introduction and the credentials behind the work.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{profile?.display_name ?? "Sadi"}</CardTitle>
          {profile?.headline && (
            <p className="text-muted-foreground text-sm">{profile.headline}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {(profile?.location || profile?.timezone) && (
            <p className="text-muted-foreground text-sm">
              {[profile.location, profile.timezone].filter(Boolean).join(" · ")}
            </p>
          )}
          <Markdown source={profile?.bio_md} />
          {!profile && (
            <p className="text-muted-foreground text-sm">
              Profile content has not been configured yet.
            </p>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="certifications">
        <h2 id="certifications" className="mb-4 text-2xl font-semibold">
          Certifications
        </h2>
        {certifications.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No certifications published yet.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {certifications.map((cert) => (
              <li key={cert.id}>
                <Card className="h-full">
                  <CardContent className="space-y-2 pt-5">
                    <p className="font-medium">{cert.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {cert.issuer}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {cert.issued_on && (
                        <Badge>Issued {formatDate(cert.issued_on)}</Badge>
                      )}
                      {cert.expires_on && (
                        <Badge>Expires {formatDate(cert.expires_on)}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
