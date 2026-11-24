import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "../../../types/supabase";

/**
 * Server-side Supabase client. Authorization always uses getClaims() — never
 * getSession() — in application code.
 *
 * `mutable: true` is only for Route Handlers and Server Actions, where cookies
 * may be written. Renders pass cookie writes through as no-ops.
 */
export async function createClient(mutable = false) {
  const env = getSupabaseEnv();
  if (!env) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        if (!mutable) return;
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // A Server Component cannot set cookies; getClaims() refreshes the
          // token in proxy.ts instead.
        }
      },
    },
  });
}
