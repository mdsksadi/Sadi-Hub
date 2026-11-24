type Ordered = { sort_order: number; id?: string };

export function bySortOrder<T extends Ordered>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      a.sort_order - b.sort_order || (a.id?.localeCompare(b.id ?? "") ?? 0),
  );
}

export function groupBy<T>(
  items: T[],
  key: (item: T) => string,
): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const group = key(item);
    groups[group] = [...(groups[group] ?? []), item];
    return groups;
  }, {});
}

export function commaList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function labelForPlatform(platform: string): string {
  const labels: Record<string, string> = {
    github: "GitHub",
    linkedin: "LinkedIn",
    email: "Email",
    x: "X",
    twitter: "X",
    website: "Website",
  };
  return labels[platform.toLowerCase()] ?? platform;
}
