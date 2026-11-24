import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "../../../types/supabase";

/** Refreshes Supabase cookies on both the request and the outgoing response. */
export function createProxyClient(
  request: NextRequest,
  response: NextResponse,
) {
  const env = getSupabaseEnv();
  if (!env) return null;

  let cookieWrites = 0;
  const client = createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookieWrites += cookiesToSet.length;
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
          });
        }
      },
    },
  });

  return {
    client,
    /** Any cookie write means an auth refresh happened: never cache that response. */
    refreshed: () => cookieWrites > 0,
  };
}
