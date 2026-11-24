import { revalidatePath } from "next/cache";

/** All finance data is private, so path-based invalidation is sufficient. */
export function revalidateFinance(): void {
  revalidatePath("/admin/finance", "layout");
  revalidatePath("/admin/dashboard");
}

export const revalidateLending = revalidateFinance;
export const revalidateDonations = revalidateFinance;
