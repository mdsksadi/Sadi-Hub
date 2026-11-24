import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "bg-muted text-muted-foreground inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}
