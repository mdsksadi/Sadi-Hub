import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "bg-background w-full rounded-md border px-3 py-2 text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
