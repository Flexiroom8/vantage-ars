export type SiteSignalEvent = {
  kind: string;
  path: string;
  referrer: string | null;
  country: string | null;
  occurredAt: string;
};

export type SiteSignalCount = {
  label: string;
  count: number;
};

export type SiteSignalDay = {
  date: string;
  count: number;
};

export type SiteSignals = {
  rangeDays: number;
  totalEvents: number;
  pageViews: number;
  countries: number;
  sources: number;
  topPages: SiteSignalCount[];
  topSources: SiteSignalCount[];
  topCountries: SiteSignalCount[];
  daily: SiteSignalDay[];
  recent: SiteSignalEvent[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function timeOf(iso: string): number {
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? time : 0;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function referrerSource(referrer: string | null | undefined): string {
  if (!referrer?.trim()) return "Direct";
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    return host || "Other";
  } catch {
    return "Other";
  }
}

function rank(map: Map<string, number>, limit: number): SiteSignalCount[] {
  return [...map.entries()]
    .filter(([label]) => label.length > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export function summarizeSiteSignals(
  events: SiteSignalEvent[],
  nowIso: string,
  rangeDays = 30,
): SiteSignals {
  const days = Math.max(1, Math.min(Math.round(rangeDays), 90));
  const now = timeOf(nowIso) || Date.now();
  const since = now - days * DAY_MS;
  const windowed = events.filter((event) => {
    const time = timeOf(event.occurredAt);
    return time >= since && time <= now + DAY_MS;
  });
  const pageEvents = windowed.filter((event) => event.kind === "page_view");

  const pages = new Map<string, number>();
  const sources = new Map<string, number>();
  const countries = new Map<string, number>();
  for (const event of pageEvents) {
    const path = event.path || "/";
    pages.set(path, (pages.get(path) ?? 0) + 1);
    const source = referrerSource(event.referrer);
    sources.set(source, (sources.get(source) ?? 0) + 1);
    const country = event.country?.trim() || "Unknown";
    countries.set(country, (countries.get(country) ?? 0) + 1);
  }

  const dailyKeys = Array.from({ length: Math.min(days, 14) }, (_, index) => {
    const date = new Date(now - (Math.min(days, 14) - 1 - index) * DAY_MS);
    return date.toISOString().slice(0, 10);
  });
  const dailyCounts = new Map<string, number>();
  for (const event of pageEvents) {
    const key = dayKey(event.occurredAt);
    if (dailyCounts.has(key)) dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
  }
  const daily = dailyKeys.map((date) => ({
    date,
    count: dailyCounts.get(date) ?? 0,
  }));

  return {
    rangeDays: days,
    totalEvents: windowed.length,
    pageViews: pageEvents.length,
    countries: countries.size,
    sources: sources.size,
    topPages: rank(pages, 8),
    topSources: rank(sources, 6),
    topCountries: rank(countries, 6),
    daily,
    recent: [...windowed].sort((a, b) => timeOf(b.occurredAt) - timeOf(a.occurredAt)).slice(0, 10),
  };
}
