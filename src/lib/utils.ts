import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(
  value: string | null | undefined,
  locale = "en-US",
): string | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
  current = false,
  locale = "en-US",
): string {
  const from = formatDate(start, locale);
  const to = current ? "Present" : formatDate(end, locale);
  if (from && to) return `${from} — ${to}`;
  return from ?? to ?? "Dates not provided";
}

export function safeExternalUrl(
  value: string | null | undefined,
  schemes = ["http:", "https:", "mailto:"],
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return schemes.includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function stripMarkdown(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
