import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteUrl } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Sadi Hub",
    template: "%s · Sadi Hub",
  },
  description: "Portfolio, experience and writing by Sadi.",
  openGraph: {
    type: "website",
    siteName: "Sadi Hub",
    url: siteUrl,
  },
  robots: { index: true, follow: true },
};

const themeScript = `
  try {
    var saved = localStorage.getItem('sadi-hub-theme');
    var dark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
