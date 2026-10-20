/**
 * Recurring billing arithmetic.
 *
 * Amounts are integer cents. Dates are ISO instants in UTC and the calendar
 * maths is done in UTC, so a subscription started at 23:30 SAST does not slip
 * a day when the server runs elsewhere. Month arithmetic clamps to the last
 * day of the target month, so a plan started on the 31st still bills on the
 * 31st where the month is long enough and on the 30th where it is not.
 *
 * Pure module. No database, no clock, no environment.
 */
import type { PlanCycle } from "./plans";

export type BillingCycle = PlanCycle;

export function cycleMonths(cycle: BillingCycle): number {
  if (cycle === "monthly") return 1;
  if (cycle === "quarterly") return 3;
  return 0;
}

/** Add whole months to an ISO instant, clamping the day to the month length. */
export function addMonths(iso: string, months: number): string {
  const base = new Date(iso);
  const from = Number.isFinite(base.getTime()) ? base : new Date(0);
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const day = from.getUTCDate();
  const target = new Date(
    Date.UTC(
      year,
      month + months,
      1,
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString();
}

/** The first instant of the next billing period. */
export function nextCycleStart(fromIso: string, cycle: BillingCycle): string {
  const months = cycleMonths(cycle);
  if (months === 0) return fromIso;
  return addMonths(fromIso, months);
}

/** The window a billing period covers. */
export function cycleWindow(startIso: string, cycle: BillingCycle): { start: string; end: string } {
  const months = cycleMonths(cycle);
  if (months === 0) return { start: startIso, end: startIso };
  return { start: startIso, end: addMonths(startIso, months) };
}

function day(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "unknown date";
  return date.toLocaleDateString("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** A human label for a billing period, e.g. "1 March 2026 to 31 March 2026". */
export function cycleLabel(startIso: string, endIso: string): string {
  return `${day(startIso)} to ${day(endIso)}`;
}

/** The same period, as a short range: "1 – 31 March 2026". */
export function cycleShortLabel(startIso: string, endIso: string): string {
  const from = new Date(startIso);
  const to = new Date(endIso);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return "this period";
  const sameMonth =
    from.getUTCMonth() === to.getUTCMonth() && from.getUTCFullYear() === to.getUTCFullYear();
  const end = to.toLocaleDateString("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (sameMonth) {
    const start = from.toLocaleDateString("en-ZA", {
      timeZone: "Africa/Johannesburg",
      day: "numeric",
    });
    return `${start} – ${end}`;
  }
  return `${day(startIso)} – ${end}`;
}

/**
 * The monthly value of a plan, so a quarterly plan can be compared with a
 * monthly one. A one-off plan has no monthly value.
 */
export function monthlyEquivalentCents(priceCents: number, cycle: BillingCycle): number {
  const months = cycleMonths(cycle);
  if (months === 0) return 0;
  return Math.round((priceCents / months) * 100) / 100;
}

/** The annual value of a plan. */
export function annualEquivalentCents(priceCents: number, cycle: BillingCycle): number {
  const months = cycleMonths(cycle);
  if (months === 0) return 0;
  return Math.round((priceCents * 12) / months);
}

/** How long a plan runs before it renews, in whole days. */
export function cycleLengthDays(cycle: BillingCycle): number {
  const months = cycleMonths(cycle);
  if (months === 0) return 0;
  return Math.round(months * 30.44);
}
