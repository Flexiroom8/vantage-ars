"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useOfficeSnapshot } from "@/components/office/office-snapshot-hook";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getServiceTime, recordServiceTime } from "@/lib/office/api";
import { formatDateTime } from "@/lib/office/format";
import type { ServiceTimeRow } from "@/lib/office/types";

function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

export function ServiceTimePanel() {
  const snapshot = useOfficeSnapshot();
  const [entries, setEntries] = useState<ServiceTimeRow[]>([]);
  const [pending, setPending] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [note, setNote] = useState("");
  const [workedAt, setWorkedAt] = useState(() => new Date().toISOString().slice(0, 10));

  const companies = [...new Set(snapshot.subscriptions.map((row) => row.companyName))].sort(
    (a, b) => a.localeCompare(b),
  );

  useEffect(() => {
    let cancelled = false;
    getServiceTime({ data: { limit: 12 } })
      .then((next) => {
        if (!cancelled) setEntries(next);
      })
      .catch(() => {
        if (!cancelled) toast.error("The support-time record could not be read.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const result = await recordServiceTime({
        data: {
          companyName,
          minutes: Number(minutes),
          note,
          workedAt,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEntries((current) =>
        [result.entry, ...current]
          .sort((a, b) => b.workedAt.localeCompare(a.workedAt))
          .slice(0, 12),
      );
      setNote("");
      toast.success("Support time recorded. A service report for that period will use it.");
    } catch {
      toast.error("The support time could not be recorded.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mt-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Support time</p>
          <h2 className="mt-2 font-serif text-2xl">Record the hours while they are real.</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            A service report now uses these entries when they exist. With no entries it falls back
            to the one-hour-per-fault estimate and labels the figure as an estimate.
          </p>
        </div>
        <Badge>{entries.length === 0 ? "estimate only" : `${entries.length} recent entries`}</Badge>
      </div>

      <form onSubmit={onSubmit} className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.5fr_0.5fr]">
        <div>
          <Label htmlFor="service-time-company">Account</Label>
          <Input
            id="service-time-company"
            className="mt-1"
            list="service-time-companies"
            required
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Customer name"
          />
          <datalist id="service-time-companies">
            {companies.map((company) => (
              <option key={company} value={company} />
            ))}
          </datalist>
        </div>
        <div>
          <Label htmlFor="service-time-minutes">Minutes</Label>
          <Input
            id="service-time-minutes"
            className="mt-1"
            type="number"
            min={1}
            max={1440}
            step={1}
            required
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="service-time-date">Work date</Label>
          <Input
            id="service-time-date"
            className="mt-1"
            type="date"
            required
            value={workedAt}
            onChange={(event) => setWorkedAt(event.target.value)}
          />
        </div>
        <div className="lg:col-span-3">
          <Label htmlFor="service-time-note">What was done</Label>
          <Textarea
            id="service-time-note"
            className="mt-1"
            required
            minLength={3}
            maxLength={500}
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="One plain sentence, written for the customer report."
          />
        </div>
        <div className="lg:col-span-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Recording…" : "Record support time"}
          </Button>
        </div>
      </form>

      {entries.length > 0 ? (
        <ul className="mt-5 divide-y divide-border border-t border-border">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <div>
                <p className="text-sm">{entry.companyName}</p>
                <p className="text-xs text-muted">{entry.note}</p>
              </div>
              <p className="font-mono text-xs text-subtle">
                {duration(entry.minutes)} · {formatDateTime(entry.workedAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
