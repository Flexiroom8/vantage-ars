import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PublicFrame } from "@/components/public/site-frame";
import { SignalBars } from "@/components/public/motion-icons";
import {
  assessAutomation,
  AUTOMATION_QUESTIONS,
  createAutomationBrief,
  type AutomationAnswers,
} from "@/lib/site/automation-assessment";
import { stageEnquiryDraft } from "@/lib/site/enquiry-draft";
import { servicePage } from "@/lib/site/services";
import { breadcrumbJsonLd, businessJsonLd, pageHead } from "@/lib/site/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/automation")({
  head: () => {
    const head = pageHead({
      title: "AI automation opportunity assessment · Vantage-ARS",
      description:
        "A private, browser-only checklist to identify workflows suitable for a bounded AI automation pilot and where human review should remain.",
      path: "/automation",
    });
    return {
      ...head,
      scripts: [
        businessJsonLd(),
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "AI automation assessment", path: "/automation" },
        ]),
      ],
    };
  },
  component: AutomationPage,
});

function AutomationPage() {
  const [answers, setAnswers] = useState<AutomationAnswers>({});
  const result = assessAutomation(answers);
  const answered = AUTOMATION_QUESTIONS.filter(
    (question) => answers[question.id] !== undefined,
  ).length;
  const service = result ? servicePage(result.serviceSlug) : undefined;
  const brief = result ? createAutomationBrief(answers, result) : null;
  const [briefStatus, setBriefStatus] = useState<string | null>(null);

  function prepareEnquiry() {
    if (!brief) return;
    const request = [
      brief,
      "",
      "Please review this workflow with me and send a written scope and quote. No system access or work is authorized by this enquiry.",
    ].join("\n");
    if (!stageEnquiryDraft(request)) {
      setBriefStatus(
        "The brief could not be prepared. Copy or download it before leaving this page.",
      );
      return;
    }
    window.location.assign("/#enquiry");
  }

  function reset() {
    setAnswers({});
    setBriefStatus(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function copyBrief() {
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(brief);
      setBriefStatus("Brief copied. Paste it into your quote enquiry when ready.");
    } catch {
      setBriefStatus("Copy was unavailable. Download the brief instead.");
    }
  }

  function downloadBrief() {
    if (!brief) return;
    const url = URL.createObjectURL(new Blob([brief], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "vantage-ars-ai-workflow-pilot-brief.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setBriefStatus("Brief downloaded to your device.");
  }

  return (
    <PublicFrame>
      <section className="enter-up border-b border-border py-14 sm:py-20">
        <p className="flex items-center gap-2 font-mono text-xs tracking-[0.22em] text-accent uppercase">
          <SignalBars className="size-4" aria-hidden="true" />
          AI workflow planning
        </p>
        <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-[0.98] tracking-[-0.03em] sm:text-7xl">
          Find the work worth automating.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Check repetition, process clarity, information quality, exceptions and the impact of
          errors. Get a practical starting point for an AI-enabled workflow without handing over
          decisions that need a person.
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-subtle">
          This is a deterministic checklist, not an AI-generated audit or a security review. Your
          answers stay in this browser; nothing is saved or sent. Do not include confidential
          business or customer information.
        </p>
        <Link
          to="/services/$slug"
          params={{ slug: "ai-automation" }}
          className="mt-5 inline-block text-sm text-accent underline-offset-4 hover:underline"
        >
          Explore AI workflow services
        </Link>
      </section>

      <div className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-5">
          {AUTOMATION_QUESTIONS.map((question, index) => (
            <fieldset key={question.id} className="panel rounded-2xl p-5 sm:p-6">
              <legend className="sr-only">{question.topic}</legend>
              <p className="font-mono text-[10px] tracking-[0.18em] text-accent uppercase">
                {String(index + 1).padStart(2, "0")} · {question.topic}
              </p>
              <h2 className="mt-2 max-w-2xl font-serif text-2xl leading-snug">{question.prompt}</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {question.options.map((option) => {
                  const selected = answers[question.id] === option.value;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "cursor-pointer rounded-lg border p-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring/70",
                        selected
                          ? "border-accent/50 bg-accent/10 text-fg"
                          : "border-border bg-surface/50 text-muted hover:bg-raised/60",
                      )}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={option.value}
                        checked={selected}
                        onChange={() =>
                          setAnswers((current) => ({ ...current, [question.id]: option.value }))
                        }
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <aside
          aria-label="Automation assessment results"
          className="lg:sticky lg:top-24 lg:self-start"
        >
          {result ? (
            <div aria-live="polite" className="panel rounded-2xl p-6">
              <p className="font-mono text-[10px] tracking-[0.18em] text-accent uppercase">
                Your starting point
              </p>
              <Badge
                variant={result.category === "prepare-first" ? "warn" : "default"}
                className="mt-3"
              >
                {result.category === "good-candidate"
                  ? "Pilot candidate"
                  : result.category === "prepare-first"
                    ? "Controls first"
                    : "Guarded pilot"}
              </Badge>
              <h2 className="mt-3 font-serif text-3xl">{result.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">{result.summary}</p>
              <div className="mt-5 border-t border-border pt-4">
                <h3 className="font-mono text-[10px] tracking-[0.18em] text-subtle uppercase">
                  Practical next steps
                </h3>
                <ol className="mt-3 list-inside list-decimal space-y-3 text-sm leading-relaxed">
                  {result.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ol>
              </div>
              {service ? (
                <Link
                  to="/services/$slug"
                  params={{ slug: service.slug }}
                  className="mt-5 inline-block text-sm text-accent underline-offset-4 hover:underline"
                >
                  Explore {service.title}
                </Link>
              ) : null}
              <div className="mt-5 border-t border-border pt-4">
                <h3 className="font-mono text-[10px] tracking-[0.18em] text-subtle uppercase">
                  Take your result with you
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Copy or download a plain-text brief generated in this browser. It is not saved or
                  sent to us. You can paste it into a quote enquiry; leave out confidential details.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" onClick={() => void copyBrief()}>
                    Copy brief
                  </Button>
                  <Button type="button" variant="secondary" onClick={downloadBrief}>
                    Download brief
                  </Button>
                </div>
                {briefStatus ? (
                  <p role="status" aria-live="polite" className="mt-3 text-xs text-muted">
                    {briefStatus}
                  </p>
                ) : null}
                <Button type="button" className="mt-3" onClick={prepareEnquiry}>
                  Prepare a written-quote request with this brief
                </Button>
              </div>
              <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-subtle">
                This result is a planning aid, not a recommendation to deploy an agent or allow
                unattended actions. Test with a human reviewer and an explicit stop condition.
              </p>
              <Button type="button" variant="secondary" className="mt-5 w-full" onClick={reset}>
                Start again
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-surface/60 p-6">
              <p className="font-mono text-[10px] tracking-[0.18em] text-subtle uppercase">
                {answered} of {AUTOMATION_QUESTIONS.length} answered
              </p>
              <h2 className="mt-3 font-serif text-2xl">Start with one real workflow.</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Think about one repeated task, not the whole business. The result distinguishes a
                promising bounded pilot from work that needs clearer controls first.
              </p>
              <div className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-subtle">
                No score is stored and no answer leaves this page.
              </div>
            </div>
          )}
        </aside>
      </div>
    </PublicFrame>
  );
}
