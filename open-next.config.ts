import type { Converter } from "@opennextjs/aws/types/overrides.js";
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import { parse as parseCookie } from "cookie";

declare global {
  var __dangerous_ON_edge_converter_returns_request: boolean | undefined;
}

const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

function getQuery(searchParams: URLSearchParams) {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of searchParams) {
    if (key in query) {
      if (Array.isArray(query[key])) {
        query[key].push(value);
      } else {
        query[key] = [query[key], value];
      }
    } else {
      query[key] = value;
    }
  }
  return query;
}

/**
 * OpenNext's edge converter uses a default import from `cookie`. In the
 * Cloudflare bundle the generated interop looks for `cookie.default.parse`,
 * but `cookie@1.x` only exposes named exports, so any request carrying a
 * Cookie header crashes before it reaches the app. This converter matches the
 * upstream edge converter but uses the named `parse` export.
 */
const cookieSafeConverter: Converter = {
  name: "edge-cookie-safe",
  convertFrom: async (event) => {
    const url = new URL(event.url);
    const headers: Record<string, string> = {};
    event.headers.forEach((value: string, key: string) => {
      headers[key] = value;
    });

    const shouldHaveBody = event.method !== "GET" && event.method !== "HEAD";
    const body = shouldHaveBody
      ? Buffer.from(await event.arrayBuffer())
      : undefined;

    const parsedCookies = event.headers.get("cookie")
      ? parseCookie(event.headers.get("cookie")!)
      : {};
    const cookies = Object.fromEntries(
      Object.entries(parsedCookies).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );

    return {
      type: "core",
      method: event.method,
      rawPath: url.pathname,
      url: event.url,
      body,
      headers,
      remoteAddress: event.headers.get("x-forwarded-for") ?? "::1",
      query: getQuery(url.searchParams),
      cookies,
    };
  },
  convertTo: async (result) => {
    if ("internalEvent" in result) {
      const internalEvent = (
        result as typeof result & {
          internalEvent: {
            url: string;
            rawPath: string;
            body?: Buffer;
            method: string;
            headers: Record<string, string>;
          };
        }
      ).internalEvent;
      const request = new Request(internalEvent.url, {
        body: internalEvent.body as BodyInit | undefined,
        method: internalEvent.method,
        headers: {
          ...internalEvent.headers,
          "x-forwarded-host": internalEvent.headers.host,
        },
      });

      if (globalThis.__dangerous_ON_edge_converter_returns_request === true) {
        return request;
      }

      const isISR = (result as typeof result & { isISR?: boolean }).isISR;
      const cfCache =
        (isISR || internalEvent.rawPath.startsWith("/_next/image")) &&
        process.env.DISABLE_CACHE !== "true"
          ? { cacheEverything: true }
          : {};

      return fetch(request, {
        cf: cfCache,
      } as RequestInit & { cf: { cacheEverything?: boolean } });
    }

    const responseHeaders = new Headers();
    for (const [key, value] of Object.entries(result.headers)) {
      if (key === "set-cookie" && typeof value === "string") {
        for (const cookie of value
          .split(/(?<!Expires=\w+),/i)
          .map((item) => item.trim())) {
          responseHeaders.append(key, cookie);
        }
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          responseHeaders.append(key, item);
        }
      } else {
        responseHeaders.set(key, value);
      }
    }

    const body = NULL_BODY_STATUSES.has(result.statusCode)
      ? null
      : (result.body as BodyInit);
    return new Response(body, {
      status: result.statusCode,
      headers: responseHeaders,
    });
  },
};

const config = defineCloudflareConfig();
const defaultOverride = config.default.override;
const middlewareOverride = (
  config.middleware as
    { override?: { converter?: () => Converter } } | undefined
)?.override;

if (!defaultOverride || !middlewareOverride) {
  throw new Error("OpenNext converter overrides are unavailable");
}

defaultOverride.converter = () => cookieSafeConverter;
middlewareOverride.converter = () => cookieSafeConverter;

// The validator only accepts the built-in `"edge"` converter string.
config.cloudflare!.dangerousDisableConfigValidation = true;

export default config;
