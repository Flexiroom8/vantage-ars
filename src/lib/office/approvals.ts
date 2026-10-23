/** How long an approval has been waiting, in whole days. */
export function approvalAgeDays(createdAt: string, now = Date.now()): number {
  const filed = Date.parse(createdAt);
  if (!Number.isFinite(filed)) return 0;
  return Math.max(0, Math.floor((now - filed) / 86_400_000));
}

/** Whether an approval has waited long enough to call it stale. */
export function isApprovalStale(createdAt: string, days = 7, now = Date.now()): boolean {
  return approvalAgeDays(createdAt, now) >= days;
}
