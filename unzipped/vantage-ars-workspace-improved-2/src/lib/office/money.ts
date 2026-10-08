const zar = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
});

export function formatZar(cents: number): string {
  return zar.format(cents / 100);
}

export function vatOn(cents: number, rate = 0.15): number {
  return Math.round(cents * rate);
}

const sastDate = new Intl.DateTimeFormat("en-ZA", {
  timeZone: "Africa/Johannesburg",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const sastTime = new Intl.DateTimeFormat("en-ZA", {
  timeZone: "Africa/Johannesburg",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const sastDateTime = new Intl.DateTimeFormat("en-ZA", {
  timeZone: "Africa/Johannesburg",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDate(iso: string): string {
  return sastDate.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return sastTime.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return `${sastDateTime.format(new Date(iso))} SAST`;
}

export function formatNowClock(): { date: string; time: string } {
  const now = new Date();
  return { date: sastDate.format(now), time: sastTime.format(now) };
}
