import Link from "next/link";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublishedPosts } from "@/lib/data/blog";
import { excerptFromMarkdown } from "@/lib/domain/blog";
import {
  getPublicExperiences,
  getPublicProfile,
  getPublicSkills,
} from "@/lib/data/portfolio";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [profile, latestPosts, experiences, skills] = await Promise.all([
    getPublicProfile(),
    getPublishedPosts({ pageSize: 3 }),
    getPublicExperiences(),
    getPublicSkills(),
  ]);
  return (
    <div className="space-y-14">
      <section className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-primary mb-2 text-sm font-medium tracking-widest uppercase">
            Welcome
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {profile?.display_name ?? "Sadi"}
          </h1>
          <p className="text-muted-foreground mt-3 text-xl">
            {profile?.headline ?? "Building useful things with software."}
          </p>
          {profile?.location && (
            <p className="text-muted-foreground mt-2 text-sm">
              {profile.location}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/about#experience">View experiences</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact">Get in touch</Link>
            </Button>
          </div>
        </div>
        <ProfileAvatar profile={profile} />
      </section>

      <section aria-labelledby="latest-blog">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="latest-blog" className="text-2xl font-semibold">
            Latest Blog
          </h2>
          <Link href="/blog" className="text-primary text-sm hover:underline">
            All posts →
          </Link>
        </div>
        {latestPosts.posts.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8">
              No published posts yet. Content appears here once the owner
              publishes it.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {latestPosts.posts.map((post) => (
              <Card key={post.id}>
                <CardHeader>
                  <CardTitle>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="hover:underline"
                    >
                      {post.title}
                    </Link>
                  </CardTitle>
                  {formatDate(post.published_at) && (
                    <p className="text-muted-foreground text-xs">
                      {formatDate(post.published_at)}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    {post.excerpt || excerptFromMarkdown(post.content_md)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section
        className="grid gap-6 md:grid-cols-2"
        aria-label="Background highlights"
      >
        <Card>
          <CardHeader>
            <CardTitle>Currently</CardTitle>
          </CardHeader>
          <CardContent>
            {experiences[0] ? (
              <div className="space-y-1">
                <p className="font-medium">{experiences[0].position}</p>
                <p className="text-muted-foreground text-sm">
                  {experiences[0].company}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No experience published yet.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top skills</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {skills.slice(0, 8).map((skill) => (
              <Badge key={skill.id}>{skill.name}</Badge>
            ))}
            {skills.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No skills published yet.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
