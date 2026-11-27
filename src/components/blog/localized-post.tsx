"use client";

import { useState, type ReactNode } from "react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";

/** Renders a post in Bangla by default and reveals English when translated. */
export function LocalizedPost({
  title,
  excerpt,
  contentMd,
  titleEn,
  excerptEn,
  contentMdEn,
  children,
}: {
  title: string;
  excerpt: string;
  contentMd: string;
  titleEn?: string | null;
  excerptEn?: string | null;
  contentMdEn?: string | null;
  children?: ReactNode;
}) {
  const [english, setEnglish] = useState(false);
  const hasEnglish = Boolean(titleEn?.trim() || contentMdEn?.trim());
  const showEnglish = english && hasEnglish;
  const displayTitle = showEnglish && titleEn?.trim() ? titleEn : title;
  const displayExcerpt = showEnglish ? excerptEn?.trim() || excerpt : excerpt;
  const displayContent = showEnglish
    ? contentMdEn?.trim() || contentMd
    : contentMd;

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {displayTitle}
          </h1>
          {hasEnglish && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={showEnglish}
              aria-label={
                showEnglish
                  ? "Switch article to Bangla"
                  : "Switch article to English"
              }
              onClick={() => setEnglish((current) => !current)}
            >
              {showEnglish ? "বাংলা" : "English"}
            </Button>
          )}
        </div>
        {displayExcerpt && (
          <p className="text-muted-foreground text-lg">{displayExcerpt}</p>
        )}
      </header>

      {children}

      <Markdown source={displayContent} className="max-w-3xl" />
    </div>
  );
}
