import { useState } from "react";
import {
  InfraIcon,
  LiveNode,
  NetworkIcon,
  SignalBars,
  VoipIcon,
} from "@/components/public/motion-icons";
import { Reveal } from "@/components/public/reveal";
import { FAULT_STOPS } from "@/lib/site/fault-path";
import type { FaultStopKey } from "@/lib/site/fault-path";
import { cn } from "@/lib/utils";

const STOP_ICONS = { phone: VoipIcon, network: NetworkIcon, system: InfraIcon } as const;

const STOPS = FAULT_STOPS.map((stop) => ({
  ...stop,
  Icon: STOP_ICONS[stop.key],
}));

type StopKey = FaultStopKey;

const SYMPTOMS: { label: string; stop: StopKey }[] = [
  { label: "Calls drop after a set time", stop: "network" },
  { label: "One-way or choppy audio", stop: "network" },
  { label: "Handset will not register", stop: "system" },
  { label: "No dial tone after a router change", stop: "network" },
  { label: "Slow Wi-Fi in parts of the building", stop: "network" },
  { label: "Devices cannot reach each other", stop: "network" },
  { label: "Recurring outages, no clear cause", stop: "system" },
  { label: "Nobody knows how the setup fits together", stop: "system" },
];

const GUIDANCE: Record<StopKey, { title: string; body: string }> = {
  phone: {
    title: "Likely the handset or the desk cabling",
    body: "The phone, softphone or the cabling at the desk. Many of these are settled during remote diagnosis, before anyone books a site visit.",
  },
  network: {
    title: "Likely the network path",
    body: "Wi-Fi, switching, routing or the route between the two ends. Remote diagnosis covers this; a site survey only when the building matters.",
  },
  system: {
    title: "Likely the phone system or server",
    body: "The PBX, registrar or server the call depends on. Configuration and testing happen only after you accept a written quote.",
  },
};

const STOP_INDEX: Record<StopKey, number> = { phone: 0, network: 1, system: 2 };

export function SignalPath() {
  const [active, setActive] = useState<StopKey | null>(null);
  const activeStop = active ? GUIDANCE[active] : null;
  const packetAt = active ? STOP_INDEX[active] : -1;

  return (
    <section className="border-t border-border py-16" aria-labelledby="signal-path-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="signal-path-heading" className="text-4xl sm:text-5xl">
          Find where the fault sits
        </h2>
        <p className="font-mono text-xs tracking-[0.18em] text-subtle uppercase">Pick a symptom</p>
      </div>
      <p className="mt-3 max-w-xl text-base text-muted">
        Most faults sit in one of three places. Choose what you are seeing and the signal goes to
        the likely stop — the written quote confirms the cause and the price.
      </p>

      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Symptoms">
        {SYMPTOMS.map((symptom) => (
          <button
            key={symptom.label}
            type="button"
            onClick={() => setActive(symptom.stop)}
            aria-pressed={active === symptom.stop}
            className={cn(
              "cursor-pointer rounded-full border px-3.5 py-2 text-sm transition-colors",
              active === symptom.stop
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-surface text-muted hover:border-accent/50 hover:text-fg",
            )}
          >
            {symptom.label}
          </button>
        ))}
      </div>

      <div className="panel mt-8 rounded-2xl p-6 sm:p-8">
        <div className="relative">
          <div aria-hidden className="absolute top-6 right-6 hidden sm:block">
            <SignalBars className="size-5 text-subtle" />
          </div>

          <div className="relative grid grid-cols-3 gap-2">
            <div
              aria-hidden
              className="absolute top-6 right-[16.66%] left-[16.66%] h-px bg-border"
            />
            <div
              aria-hidden
              className="absolute top-6 h-px bg-accent/60 transition-all duration-700 ease-out"
              style={{
                left: "16.66%",
                width: packetAt >= 0 ? `${packetAt * 33.33}%` : "0%",
                boxShadow: packetAt >= 0 ? "var(--glow-accent)" : "none",
              }}
            />
            {packetAt >= 0 ? (
              <div
                aria-hidden
                className="absolute top-6 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent transition-all duration-700 ease-out"
                style={{
                  left: `calc(16.66% + ${packetAt * 33.33}%)`,
                  boxShadow: "var(--glow-accent)",
                }}
              />
            ) : null}

            {STOPS.map((stop) => {
              const isActive = active === stop.key;
              return (
                <div key={stop.key} className="relative flex flex-col items-center text-center">
                  <span
                    className={cn(
                      "flex size-12 items-center justify-center rounded-xl border bg-bg transition-colors duration-300",
                      isActive ? "border-accent text-accent" : "border-border text-muted",
                    )}
                  >
                    <stop.Icon className="size-6" />
                  </span>
                  {isActive ? (
                    <span className="absolute -top-1.5 -right-1.5">
                      <LiveNode className="size-4" />
                    </span>
                  ) : null}
                  <p
                    className={cn(
                      "mt-3 text-lg transition-colors",
                      isActive ? "text-fg" : "text-muted",
                    )}
                  >
                    {stop.title}
                  </p>
                  <p className="mt-1 hidden max-w-[16rem] text-sm leading-relaxed text-subtle sm:block">
                    {stop.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6" aria-live="polite">
          {activeStop ? (
            <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="font-mono text-[11px] tracking-[0.2em] text-ok uppercase">
                  Most likely stop
                </p>
                <h3 className="mt-2 text-2xl text-fg">{activeStop.title}</h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                  {activeStop.body}
                </p>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <p className="font-mono text-2xl text-accent">R690</p>
                <p className="mt-1 font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">
                  per hour remote · 30-min minimum
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-subtle">
              Pick a symptom above and the signal shows where most of those faults sit. The cause is
              confirmed in the written quote before any work starts.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** Static version for narrower slots (service pages). */
export function SignalPathCompact() {
  return (
    <Reveal className="panel rounded-2xl p-6">
      <p className="font-mono text-[11px] tracking-[0.2em] text-accent uppercase">Call path</p>
      <h3 className="mt-3 text-2xl">Handset, network, system</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        We work through the fault in that order, remotely first. On-site by arrangement at R805 an
        hour when the building matters.
      </p>
    </Reveal>
  );
}
