type KVLike = {
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  list(options: { prefix: string }): Promise<{ keys: unknown[] }>;
};

type Bucket = { count: number; resetAt: number };

const memory = new Map<string, Bucket>();

async function getKv(): Promise<KVLike | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return ((env as Record<string, unknown>).RATE_LIMIT_KV as KVLike) ?? null;
  } catch {
    return null;
  }
}

/**
 * Fixed-window rate limiter.
 *
 * Production uses one expiring KV marker per request under a shared prefix.
 * Counting keys avoids the lost updates of a read-modify-write counter when
 * several Worker isolates handle requests concurrently. KV is eventually
 * consistent, so the limit is approximate but never silently disabled.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();
  const window = Math.floor(now / (windowSeconds * 1000));
  const prefix = `ratelimit:${key}:${window}:`;
  const kv = await getKv();

  if (!kv) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        JSON.stringify({
          level: "error",
          scope: "rate_limit",
          message: "RATE_LIMIT_KV is unavailable; failing closed",
        }),
      );
      return { allowed: false, remaining: 0 };
    }

    const recordKey = `dev:${prefix}`;
    const current = memory.get(recordKey);
    const bucket: Bucket =
      current && current.resetAt > now
        ? current
        : { count: 0, resetAt: now + windowSeconds * 1000 };
    bucket.count += 1;
    memory.set(recordKey, bucket);
    return {
      allowed: bucket.count <= limit,
      remaining: Math.max(0, limit - bucket.count),
    };
  }

  try {
    await kv.put(`${prefix}${now}-${crypto.randomUUID()}`, "1", {
      expirationTtl: Math.max(60, windowSeconds),
    });
    const listed = await kv.list({ prefix });
    const count = listed.keys.length;
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        scope: "rate_limit",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return { allowed: false, remaining: 0 };
  }
}

export function clientIp(request: { headers: Headers }): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
