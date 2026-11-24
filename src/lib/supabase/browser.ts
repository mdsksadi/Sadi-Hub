"use client";

import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "../../../types/supabase";

export function createClient() {
  const env = getSupabaseEnv();
  if (!env) return null;
  return createSupabaseBrowserClient<Database>(env.url, env.key, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });
}
