import Image from "next/image";
import { cn } from "@/lib/utils";
import { PUBLIC_BUCKET, publicObjectUrl } from "@/lib/supabase/storage";
import type { PublicProfile } from "../../types/supabase";

/** Shared circular avatar used at the top-right of public page headers. */
export function ProfileAvatar({
  profile,
  className,
}: {
  profile: PublicProfile | null;
  className?: string;
}) {
  const src = publicObjectUrl(PUBLIC_BUCKET, profile?.avatar_path ?? null);
  if (!src) return null;

  return (
    <Image
      src={src}
      alt={`${profile?.display_name ?? "Sadi"}'s avatar`}
      width={192}
      height={192}
      unoptimized
      priority
      className={cn(
        "ring-border h-40 w-40 rounded-full object-cover ring-2 sm:h-48 sm:w-48",
        className,
      )}
    />
  );
}
