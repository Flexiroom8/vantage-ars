import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PublicFrame } from "@/components/public/site-frame";
import { SignalBars } from "@/components/public/motion-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ASSESSMENT_QUESTIONS,
  assessReadiness,
  createReadinessEnquiryDraft,
  type AssessmentAnswers,
  type AssessmentAnswer,
} from "@/lib/site/assessment";
import { stageEnquiryDraft } from "@/lib/site/enquiry-draft";
import { rateAmountLabel } from "@/lib/office/catalogue";
import { servicePage } from "@/lib/site/services";
import { breadcrumbJsonLd, businessJsonLd, pageHead } from "@/lib/site/seo";
import { cn } from "@/lib/utils";

const ANSWERS: { value: AssessmentAnswer; label: string }[] = [
  { value: "unknown", label: "I don't know" },
  { value: "no", label: "No, or not in place" },
  { value: "partial", label: "Partly" },
  { value: "yes", label: "Yes, and it is reviewed" },
];

export const Route = createFileRoute("/assess")({
  head: () => {
    const head = pageHead({
      title: "IT readiness self-assessment · Vantage-ARS",
      description:
        "Review seven practical IT operations questions, identify areas to verify and find relevant Vantage-ARS service lines. Answers stay in your browser.",
      path: "/assess",
    });
    return {
      ...head,
      scripts: [
        businessJsonLd(),
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "IT readiness assessment", path: "/assess" },
        ]),
      ],
    };
  },
  component: AssessmentPage,
});

function AssessmentPage() {
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const result = assessReadiness(answers);
  const answered = ASSESSMENT_QUESTIONS.filter(
    (question) => answers[question.id] !== undefined,
  ).length;
  const [enquiryError, setEnquiryError] = useState("");

  function requestPaidAssessment() {
    if (!result) return;
    const draft = createReadinessEnquiryDraft(result, rateAmountLabel("assessment"));
    if (!stageEnquiryDraft(draft)) {
      setEnquiryError(
        "The result could not be prepared. Copy the summary before leaving this page.",
      );
      return;
    }
    window.location.assign("/#enquiry");
  }

  function reset() {
    setAnswers({});
    setEnquiryError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <PublicFrame>
      <section className="enter-up border-b border-border py-14 sm:py-20">
        <p className="flex items-center gap-2 font-mono text-xs tracking-[0.22em] text-accent uppercase">
          <SignalBars className="size-4" aria-hidden="true" />A practical starting point
        </p>
        <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-[0.98] tracking-[-0.03em] sm:text-7xl">
          How well documented is your IT?
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Review seven everyday practices across accounts, recovery, networks and support. The
          result is a self-assessment, not a technical audit, security test or compliance
          certification.
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-subtle">
          Your answers stay in this browser and are not sent to Vantage-ARS. Do not enter passwords,
          customer names or other sensitive information.
        </p>
      </section>

      <div className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-5">
          {ASSESSMENT_QUESTIONS.map((question, index) => (
            <fieldset key={question.id} className="panel rounded-2xl p-5 sm:p-6">
              <legend className="sr-only">{question.topic}</legend>
              <p className="font-mono text-[10px] tracking-[0.18em] text-accent uppercase">
                {String(index + 1).padStart(2, "0")} · {question.topic}
              </p>
              <h2 className="mt-2 max-w-2xl font-serif text-2xl leading-snug">{question.prompt}</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {ANSWERS.map((option) => {
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

        <aside aria-label="Assessment results" className="lg:sticky lg:top-24 lg:self-start">
          {result ? (
            <div aria-live="polite" className="panel rounded-2xl p-6">
              <p className="font-mono text-[10px] tracking-[0.18em] text-accent uppercase">
                Your self-assessment
              </p>
              <h2 className="mt-3 font-serif text-3xl">{result.label}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {result.score === null
                  ? "There is not enough information to calculate a score. Verify the practices below with the people responsible for them."
                  : `${result.score}% across ${result.reviewed} practices you could assess. ${result.unverified} ${
                      result.unverified === 1 ? "practice is" : "practices are"
                    } still unverified.`}
              </p>
              <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-subtle">
                This is a reflection aid, not a risk rating or independent assessment. It does not
                test systems or verify your answers.
              </p>
              {result.priorities.length > 0 ? (
                <div className="mt-5">
                  <h3 className="font-mono text-[10px] tracking-[0.18em] text-subtle uppercase">
                    Useful next steps
                  </h3>
                  <ul className="mt-3 space-y-4">
                    {result.priorities.map((finding) => {
                      const service = servicePage(finding.serviceSlug);
                      return (
                        <li key={finding.id} className="border-b border-border pb-3 last:border-0">
                          <Badge variant={finding.status === "verify" ? "warn" : "default"}>
                            {finding.status === "verify" ? "Verify" : "Improve"}
                          </Badge>
                          <p className="mt-2 text-sm leading-relaxed">{finding.nextStep}</p>
                          {service ? (
                            <Link
                              to="/services/$slug"
                              params={{ slug: service.slug }}
                              className="mt-2 inline-block text-xs text-accent underline-offset-4 hover:underline"
                            >
                              Explore {service.title}
                            </Link>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <p className="mt-5 text-sm text-muted">
                  Your answers indicate these practices are reviewed. Keep evidence current and
                  revisit them as systems change.
                </p>
              )}
              <div className="mt-5 border-t border-border pt-4">
                <h3 className="font-serif text-xl">Want a technical review?</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Request a paid initial remote assessment for up to 60 minutes at{" "}
                  {rateAmountLabel("assessment")}. We will confirm scope and VAT treatment in
                  writing before any work starts. Your answers remain in this browser unless you
                  choose to attach the summary to your enquiry.
                </p>
                <Button type="button" className="mt-4 w-full" onClick={requestPaidAssessment}>
                  Prepare a written-quote request
                </Button>
                {enquiryError ? (
                  <p role="alert" className="mt-2 text-xs text-danger">
                    {enquiryError}
                  </p>
                ) : null}
              </div>
              <Button type="button" variant="secondary" className="mt-5 w-full" onClick={reset}>
                Start again
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-surface/60 p-6">
              <p className="font-mono text-[10px] tracking-[0.18em] text-subtle uppercase">
                {answered} of {ASSESSMENT_QUESTIONS.length} answered
              </p>
              <h2 className="mt-3 font-serif text-2xl">Your answers make the result useful.</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Choose “I don't know” when you cannot verify a practice. The result will separate
                unknowns from practices you can assess.
              </p>
              <div className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-subtle">
                No answers leave this page or get saved.
              </div>
            </div>
          )}
        </aside>
      </div>
    </PublicFrame>
  );
}
