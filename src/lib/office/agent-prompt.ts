/** Keep untrusted task and customer text inside a JSON value, not prompt markup. */
export function serializeUntrustedContext(context: Record<string, unknown>): string {
  return JSON.stringify(context).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}
