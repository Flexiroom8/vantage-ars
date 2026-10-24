import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";

import { PublicFrame } from "@/components/public/site-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkEmailAuth,
  DIAGNOSTIC_DRAFT_KEY,
  emailAuthSummary,
  type EmailAuthCheck,
} from "@/lib/site/email-auth-check";
import { pageHead } from "@/lib/site/seo";

export const Route = createFileRoute("/tools/email-auth")({
  head: () =>
    pageHead({
      title: "Email authentication DNS check · Vantage-ARS",
      description:
        "Check public SPF, DKIM and DMARC DNS records for a domain. A read-only diagnostic, not a mail delivery guarantee.",
      path: "/tools/email-auth",
    }),
  component: EmailAuthPage,
});

function EmailAuthPage() {
  const [domain, setDomain] = useState("");
  const [selector, setSelector] = useState("");
  const [result, setResult] = useState<EmailAuthCheck | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function runCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setResult(null);
    try {
      setResult(await checkEmailAuth(domain, selector));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The DNS check failed.");
    } finally {
      setPending(false);
    }
  }

  function attachResult() {
    if (!result) return;
    try {
      window.sessionStorage.setItem(DIAGNOSTIC_DRAFT_KEY, emailAuthSummary(result));
      window.location.assign("/support#enquiry-form");
    } catch {
      setError(
        "The result could not be saved for the support form. Copy it before leaving this page.",
      );
    }
  }

  const checks = result
    ? [
        { label: "SPF", ...result.spf },
        { label: "DMARC", ...result.dmarc },
        { label: `DKIM · ${result.dkim.selector}`, ...result.dkim },
      ]
    : [];

  return (
    <PublicFrame>
      <article className="enter-up max-w-3xl py-16">
        <p className="font-mono text-xs tracking-[0.22em] text-accent uppercase">
          Free browser diagnostic
        </p>
        <h1 className="mt-4 font-serif text-5xl tracking-[-0.03em] sm:text-7xl">
          Check email authentication
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
          Look up public SPF and DMARC TXT records, plus a DKIM selector you provide. The query goes
          from your browser to Google Public DNS. No result is stored by Vantage-ARS unless you
          choose to attach it to a support request.
        </p>

        <form onSubmit={runCheck} className="glass mt-8 space-y-4 rounded-2xl p-5">
          <div>
            <Label htmlFor="email-check-domain">Domain</Label>
            <Input
              id="email-check-domain"
              className="mt-2"
              autoComplete="url"
              required
              maxLength={253}
              placeholder="example.co.za"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="email-check-selector">DKIM selector</Label>
            <Input
              id="email-check-selector"
              className="mt-2"
              required
              maxLength={63}
              placeholder="selector1"
              value={selector}
              onChange={(event) => setSelector(event.target.value)}
            />
            <p className="mt-1 text-xs text-subtle">
              Find this in your mail provider’s DKIM settings. Selectors are provider-specific.
            </p>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="cta border-0">
            {pending ? "Checking public DNS…" : "Check records"}
          </Button>
        </form>

        {result ? (
          <section aria-live="polite" className="panel mt-8 rounded-2xl p-6">
            <h2 className="font-serif text-3xl">Records for {result.domain}</h2>
            <dl className="mt-5 space-y-4">
              {checks.map(({ label, state, records }) => (
                <div key={label} className="border-b border-border pb-4">
                  <dt className="flex items-center justify-between gap-3">
                    <span className="font-medium">{label}</span>
                    <span className="font-mono text-xs text-accent">{state}</span>
                  </dt>
                  <dd className="mt-2 break-all font-mono text-xs leading-relaxed text-muted">
                    {records.length ? records.join("\n") : "No matching TXT record found"}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-subtle">
              A DNS record check does not prove messages align or reach inboxes. A missing DKIM
              record may also mean the selector differs.
            </p>
            <Button type="button" onClick={attachResult} className="cta mt-5 border-0">
              Attach result to a support request
            </Button>
          </section>
        ) : null}
      </article>
    </PublicFrame>
  );
}
