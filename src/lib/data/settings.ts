import { createClient } from "@/lib/supabase/server";
import type { Database } from "../../../types/supabase";

export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"];

export async function getOwnerSettings(
  userId: string,
): Promise<UserSettings | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}
