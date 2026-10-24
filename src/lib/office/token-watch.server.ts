import { classifyCloudflareToken, tokenVerdict, type TokenVerdict } from "./token-watch";

/**
 * Ask Cloudflare whether the host token is alive.
 * The bearer value is sent once and never written into the result.
 */
export async function inspectCloudflareToken(
  env: Record<string, string | undefined> = process.env,
): Promise<TokenVerdict> {
  const shape = classifyCloudflareToken(env.CLOUDFLARE_API_TOKEN);
  if (shape.state !== "present") return tokenVerdict(shape, null);
  const token = env.CLOUDFLARE_API_TOKEN?.trim() ?? "";
  try {
    const response = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    let ok = response.ok;
    try {
      const body = (await response.json()) as { success?: boolean };
      if (typeof body.success === "boolean") ok = body.success;
    } catch {
      ok = response.ok;
    }
    return tokenVerdict(shape, { ok, status: response.status });
  } catch {
    return tokenVerdict(shape, null);
  }
}
