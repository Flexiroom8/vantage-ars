/**
 * Durable fixed-window rate limit. The in-memory limiter in guard.ts only holds
 * inside one server instance; this one counts in the database so it holds across
 * instances and restarts. It fails OPEN: if the database errors, the request is
 * allowed and the in-memory limiter remains the backstop.
 */
export type SqlLike = <T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<T[]>;

export async function durableAllow(
  sql: SqlLike,
  bucket: string,
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): Promise<boolean> {
  try {
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const rows = await sql<{ hits: number }>`
      insert into rate_hits (bucket, key, window_start, hits)
      values (${bucket}, ${key}, ${windowStart}, 1)
      on conflict (bucket, key, window_start)
      do update set hits = rate_hits.hits + 1
      returning hits
    `;
    const hits = Number(rows[0]?.hits ?? 1);
    if (Math.random() < 0.02) {
      // Opportunistic cleanup of windows that ended more than a day ago.
      await sql`delete from rate_hits where window_start < ${now - 24 * 60 * 60 * 1000 - windowMs}`;
    }
    return hits <= limit;
  } catch {
    return true;
  }
}
