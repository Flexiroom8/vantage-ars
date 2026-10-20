/**
 * The schedule, as code.
 *
 * The office's "will" is a version-controlled artefact, not a hidden list. This
 * module turns a duty registry into an inspectable schedule file that can be
 * diffed, hashed and reviewed like any other source: if the office's behaviour
 * changes, the schedule's version string changes with it, and the change is
 * visible in a commit rather than buried in a log line.
 *
 * Deliberately does not: import the duty registry (the caller passes the maps
 * in, so this module stays free of the office's data), touch the database, read
 * a clock, or run anything. Every function here is a pure function of its
 * arguments, and every timestamp arrives as a parameter.
 *
 * Hashing. The repo's `hash.ts` uses `node:crypto` and is therefore server
 * only, so it cannot be imported into a module that has to run in the browser
 * or at the edge. This module carries its own small FNV-1a hash instead — it is
 * not a cryptographic hash and does not pretend to be one. It is a stable
 * fingerprint of content: the same content always fingerprints the same way,
 * and different content almost never fingerprints the same. That is exactly
 * what a schedule version and a manifest fingerprint need.
 *
 * Two content hashes are offered, and the difference matters:
 *
 *   - `manifestHash` fingerprints a *sequence* of scheduled fires. A manifest is
 *     a timeline, so order is part of its meaning: the same fires in a
 *     different order are a different manifest.
 *   - `taskGraphHash` fingerprints the *graph of work* a manifest produced. The
 *     same work captured in a different order is the same work, so the rows
 *     are sorted before hashing — a replay must match a capture that ran the
 *     rows in another order.
 *
 * The fire grid is anchored at the Unix epoch (1970-01-01T00:00:00Z), so the
 * schedule is the same for everybody and reproducible from any timestamp: a
 * duty fires at every whole multiple of its interval since the epoch.
 */

export type ScheduleEntry = {
  duty: string;
  owner: string;
  title: string;
  /** The interval in minutes between fires. */
  everyMinutes: number;
  /** 0 = highest urgency. */
  priority: number;
};

export type ScheduleFile = {
  version: string;
  entries: ScheduleEntry[];
};

/** Milliseconds in a minute. */
const MINUTE_MS = 60_000;
/** Minutes in an hour. */
const HOUR_MINUTES = 60;
/** Minutes in a day. */
const DAY_MINUTES = 24 * HOUR_MINUTES;
/** The fire grid's anchor: 1970-01-01T00:00:00Z. */
const GRID_ANCHOR_MS = 0;
/** The version prefix of a schedule file's version string. */
export const SCHEDULE_FORMAT_VERSION = "sched-v1";
/** How many hex characters of the content hash the version string carries. */
const VERSION_HASH_LENGTH = 12;
/** A separator that cannot appear in a duty id, a title or a timestamp. */
const FIELD_SEPARATOR = "\u001f";
/** A separator that cannot appear in a canonical field. */
const RECORD_SEPARATOR = "\u001e";

// ── The local deterministic hash ──────────────────────────────────────────────

/**
 * FNV-1a, 64-bit, over the UTF-8 bytes of a string.
 *
 * Small, dependency-free and identical on every runtime, which is the point:
 * a schedule version computed on a laptop must equal the same version computed
 * in the office. It is a fingerprint, not a security primitive — do not use it
 * to detect tampering, only to detect change.
 */
const FNV64_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x100000001b3n;
const UINT64_MASK = 0xffffffffffffffffn;

function fnv1a64Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let hash = FNV64_OFFSET_BASIS;
  for (const byte of bytes) {
    hash = ((hash ^ BigInt(byte)) * FNV64_PRIME) & UINT64_MASK;
  }
  return hash.toString(16).padStart(16, "0");
}

// ── Building the schedule file ────────────────────────────────────────────────

/** One canonical line per entry, so two equal schedules canonicalise equally. */
function canonicalEntry(entry: ScheduleEntry): string {
  return [
    entry.duty,
    entry.owner,
    entry.title,
    String(entry.everyMinutes),
    String(entry.priority),
  ].join(FIELD_SEPARATOR);
}

function entriesHash(entries: ScheduleEntry[]): string {
  return fnv1a64Hex(entries.map(canonicalEntry).join(RECORD_SEPARATOR));
}

/**
 * Turn the duty registry into a schedule file.
 *
 * The entries are sorted by duty id so the file reads in a stable order no
 * matter how the registry was written, and the version is derived from the
 * content, so it changes exactly when the schedule changes and not otherwise.
 *
 * Urgency is derived from cadence, because that is the only urgency signal the
 * registry carries: the duty that fires most often is the one that matters
 * most, so the distinct intervals are ranked from zero. Two duties on the same
 * interval share a priority.
 */
export function buildSchedule(
  duties: Record<string, number>,
  owners: Record<string, string>,
  titles: Record<string, string>,
): ScheduleFile {
  const dutyIds = Object.keys(duties).sort();
  const intervals = [...new Set(dutyIds.map((duty) => duties[duty]))].sort((a, b) => a - b);
  const rank = new Map<number, number>();
  intervals.forEach((minutes, index) => rank.set(minutes, index));

  const entries: ScheduleEntry[] = dutyIds.map((duty) => ({
    duty,
    owner: owners[duty] ?? "",
    title: titles[duty] ?? "",
    everyMinutes: duties[duty],
    priority: rank.get(duties[duty]) ?? 0,
  }));

  const version = `${SCHEDULE_FORMAT_VERSION}.${entriesHash(entries).slice(0, VERSION_HASH_LENGTH)}`;
  return { version, entries };
}

/** The fingerprint of a whole schedule file, version included. */
export function scheduleHash(file: ScheduleFile): string {
  return fnv1a64Hex([file.version, entriesHash(file.entries)].join(RECORD_SEPARATOR));
}

// ── Reading the schedule ─────────────────────────────────────────────────────

/** "every 10 minutes", "every 4 hours", "every 7 days". */
function readableInterval(minutes: number): string {
  if (minutes <= 0) return "never";
  if (minutes % DAY_MINUTES === 0) return `every ${plural(minutes / DAY_MINUTES, "day")}`;
  if (minutes % HOUR_MINUTES === 0) return `every ${plural(minutes / HOUR_MINUTES, "hour")}`;
  return `every ${plural(minutes, "minute")}`;
}

function plural(count: number, unit: string): string {
  return count === 1 ? `1 ${unit}` : `${count} ${unit}s`;
}

/**
 * The schedule as a human-readable table.
 *
 * `everyMinutes` is the interval in words; `firesPerDay` is how often the duty
 * runs in a day, to two decimal places, so a weekly duty reads as a fraction
 * of a day rather than pretending to be daily.
 */
export function scheduleRows(file: ScheduleFile): {
  duty: string;
  owner: string;
  title: string;
  everyMinutes: string;
  firesPerDay: string;
}[] {
  return file.entries.map((entry) => ({
    duty: entry.duty,
    owner: entry.owner,
    title: entry.title,
    everyMinutes: readableInterval(entry.everyMinutes),
    firesPerDay: entry.everyMinutes > 0 ? (DAY_MINUTES / entry.everyMinutes).toFixed(2) : "0.00",
  }));
}

// ── The fire grid ─────────────────────────────────────────────────────────────

function intervalMs(entry: ScheduleEntry): number {
  if (!(entry.everyMinutes > 0)) throw new Error(`Duty ${entry.duty} has no cadence.`);
  return entry.everyMinutes * MINUTE_MS;
}

function parseInstant(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/**
 * The next fire instant strictly after `fromIso`.
 *
 * Fires sit on the epoch-anchored grid, so an instant that is itself on the
 * grid still moves forward by one whole interval: the duty that ran at 09:00
 * next runs at 09:10, not at 09:00 again.
 */
export function dueAt(entry: ScheduleEntry, fromIso: string): string {
  const fromMs = parseInstant(fromIso);
  if (!Number.isFinite(fromMs)) throw new Error(`Not an instant: ${fromIso}`);
  const step = intervalMs(entry);
  const index = Math.floor((fromMs - GRID_ANCHOR_MS) / step) + 1;
  return new Date(GRID_ANCHOR_MS + index * step).toISOString();
}

/**
 * Every fire between two instants, in order: the start instant counts as a
 * fire, the end instant does not.
 *
 * A ten-minute duty over one hour yields six fires (the start plus five more),
 * and a daily duty over a week yields seven.
 */
export function expectedFires(entry: ScheduleEntry, fromIso: string, toIso: string): string[] {
  const fromMs = parseInstant(fromIso);
  const toMs = parseInstant(toIso);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) throw new Error("Not an instant");
  if (toMs <= fromMs) return [];
  const step = intervalMs(entry);
  const first = Math.ceil((fromMs - GRID_ANCHOR_MS) / step);
  const last = Math.ceil((toMs - GRID_ANCHOR_MS) / step);
  const fires: string[] = [];
  for (let index = first; index < last; index += 1) {
    fires.push(new Date(GRID_ANCHOR_MS + index * step).toISOString());
  }
  return fires;
}

// ── Content fingerprints ─────────────────────────────────────────────────────

/**
 * The fingerprint of a manifest: an ordered sequence of scheduled fires.
 *
 * Order is part of a manifest's meaning, so this hash is order-sensitive: the
 * same fires in a different order are a different manifest.
 */
export function manifestHash(entries: { duty: string; scheduledAt: string }[]): string {
  const canonical = entries
    .map((entry) => `${entry.duty}${FIELD_SEPARATOR}${entry.scheduledAt}`)
    .join(RECORD_SEPARATOR);
  return fnv1a64Hex(canonical);
}

/**
 * The fingerprint of the task graph a manifest produced.
 *
 * Order is NOT part of a graph's meaning, so the rows are sorted before
 * hashing: a replay of the same work must match a capture that recorded the
 * rows in a different order.
 */
export function taskGraphHash(
  rows: { duty: string; agentId: string; kind: string; priority: number }[],
): string {
  const canonical = [...rows]
    .map(
      (row) =>
        `${row.duty}${FIELD_SEPARATOR}${row.agentId}${FIELD_SEPARATOR}${row.kind}${FIELD_SEPARATOR}${row.priority}`,
    )
    .sort()
    .join(RECORD_SEPARATOR);
  return fnv1a64Hex(canonical);
}
