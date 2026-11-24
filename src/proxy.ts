import { NextResponse, type NextRequest } from "next/server";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { createProxyClient } from "@/lib/supabase/proxy";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

function secure<T extends NextResponse>(response: T, isPrivate = false): T {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  if (isPrivate) {
    for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
      response.headers.set(key, value);
    }
  }
  return response;
}

function carryCookies(from: NextResponse, to: NextResponse): void {
  for (const cookie of from.headers.getSetCookie?.() ?? []) {
    to.headers.append("set-cookie", cookie);
  }
}

function isPrivatePath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/mfa/setup"
  );
}

function hasValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return request.headers.get("sec-fetch-site") !== "cross-site";
  }
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const privatePath = isPrivatePath(pathname);
  const response = secure(NextResponse.next({ request }), privatePath);
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(
    request.method,
  );

  if (isMutation && !hasValidOrigin(request)) {
    return secure(new NextResponse("Invalid origin", { status: 403 }), true);
  }

  if (request.method === "POST" && pathname === "/admin/login") {
    const { allowed } = await rateLimit(`login:${clientIp(request)}`, 8, 300);
    if (!allowed) {
      return secure(
        NextResponse.json(
          { error: "Too many attempts. Please try again later." },
          { status: 429 },
        ),
        true,
      );
    }
  }

  if (request.method === "POST" && pathname === "/mfa/setup") {
    const { allowed } = await rateLimit(`mfa:${clientIp(request)}`, 5, 300);
    if (!allowed) {
      return secure(
        NextResponse.json(
          { error: "Too many attempts. Please try again later." },
          { status: 429 },
        ),
        true,
      );
    }
  }

  if (request.method === "POST" && pathname === "/api/contact") {
    const { allowed } = await rateLimit(`contact:${clientIp(request)}`, 3, 900);
    if (!allowed) {
      return secure(
        NextResponse.json(
          { error: "Too many messages. Please try again later." },
          { status: 429 },
        ),
        true,
      );
    }
  }

  const guardedAdmin =
    pathname === "/admin" ||
    (pathname.startsWith("/admin/") && pathname !== "/admin/login");
  let authRefreshed = false;

  if (guardedAdmin) {
    const auth = createProxyClient(request, response);
    if (!auth) {
      const redirect = secure(
        NextResponse.redirect(
          new URL("/admin/login?reason=config", request.url),
        ),
        true,
      );
      carryCookies(response, redirect);
      return redirect;
    }

    let authenticated = false;
    let mfa = false;
    try {
      const { data } = await auth.client.auth.getClaims();
      authenticated = Boolean(data?.claims?.sub);
      mfa = data?.claims?.aal === "aal2";
      authRefreshed = auth.refreshed();
    } catch {
      authenticated = false;
    }

    if (!authenticated || !mfa) {
      const reason = authenticated ? "mfa" : "unauthorized";
      const redirect = secure(
        NextResponse.redirect(
          new URL(`/admin/login?reason=${reason}`, request.url),
        ),
        true,
      );
      carryCookies(response, redirect);
      return redirect;
    }
  }

  // A refreshed Supabase session must never be cached.
  if (authRefreshed || response.headers.has("set-cookie")) {
    secure(response, true);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
