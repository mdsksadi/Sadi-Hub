import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { getPublicProfile, getPublicSocialLinks } from "@/lib/data/portfolio";
import { labelForPlatform } from "@/lib/domain/portfolio";
import { safeExternalUrl } from "@/lib/utils";

const nav = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/experience", label: "Experience" },
  { href: "/education", label: "Education" },
  { href: "/skills", label: "Skills" },
  { href: "/projects", label: "Projects" },
  { href: "/blog", label: "Blog" },
  { href: "/resume", label: "Resume" },
  { href: "/contact", label: "Contact" },
];

export default async function SiteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [profile, socialLinks] = await Promise.all([
    getPublicProfile(),
    getPublicSocialLinks(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only rounded-md px-3 py-2 focus:not-sr-only"
      >
        Skip to content
      </a>
      <header className="no-print bg-card/80 border-b backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="mr-auto text-lg font-semibold tracking-tight"
          >
            {profile?.display_name ?? "Sadi Hub"}
          </Link>
          <nav
            aria-label="Main navigation"
            className="order-3 w-full overflow-x-auto pb-1 md:order-none md:w-auto md:pb-0"
          >
            <ul className="flex gap-1 text-sm">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-2.5 py-1.5 whitespace-nowrap"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        {children}
      </main>

      <footer className="no-print border-t">
        <div className="text-muted-foreground mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {profile?.display_name ?? "Sadi"}. All
            rights reserved.
          </p>
          {socialLinks.length > 0 && (
            <ul className="flex flex-wrap gap-4">
              {socialLinks.map((link) => {
                const href = safeExternalUrl(link.url);
                if (!href) return null;
                return (
                  <li key={link.id}>
                    <a
                      href={href}
                      className="hover:text-foreground"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {labelForPlatform(link.platform)}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </footer>
    </div>
  );
}
