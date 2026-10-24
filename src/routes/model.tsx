import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicFrame } from "@/components/public/site-frame";
import { pageHead } from "@/lib/site/seo";

export const Route = createFileRoute("/model")({
  head: () =>
    pageHead({
      title: "How the office runs · Vantage-ARS",
      description:
        "How ten software agents handle Vantage-ARS office workflows, and where customer infrastructure work still requires written scope. Live monitoring and automated fault fixes are not currently offered.",
      path: "/model",
    }),
  component: ModelPage,
});

const FLOOR = [
  ["FOYER", "Reception", "Classifies inbound. Does not sell."],
  ["SIGNAL", "Marketing", "Qualifies demand, then stops."],
  ["CLOSE", "Sales", "Drafts the quote after a handoff."],
  ["DESK", "Service", "Acknowledges faults. Does not concede."],
  ["FORGE", "Technical", "Writes the procedure. Does not spend."],
  ["LEDGER", "Finance", "Invoices from records. Cash out waits."],
  ["KEEP", "Admin", "Files. Does not sign."],
  ["VANTAGE", "Orchestrator", "Coordinates. Does not sell or spend."],
  ["SEAL", "Compliance", "Can veto an off-role action."],
  ["KEY", "Credentials", "Checks the Cloudflare token. Cannot replace it."],
] as const;

const PATH = [
  ["Enquiry", "FOYER records what was actually written."],
  ["Qualify", "SIGNAL scores it. A sale stops here."],
  ["Handoff", "The founder, or a standing delegation, moves it to sales."],
  ["Quote", "CLOSE drafts scope and total from the published rate."],
  ["Accept", "The customer accepts in writing. Nothing starts before that."],
  ["Do the work", "FORGE and DESK stay inside the accepted scope."],
  ["Invoice", "LEDGER bills only recorded work."],
  ["Receipt", "Money is booked when it is confirmed, not when it is claimed."],
] as const;

const AUTHORIZED_TIERS = [
  {
    title: "Observe · read-only",
    body: "A possible future tier, not a service currently included or enabled. It would use outbound-only agents or approved vendor APIs to check SIP registration, synthetic calls, DNS and mail records, and read-only Microsoft or Google logs.",
  },
  {
    title: "Diagnose · human reviewed",
    body: "A possible future tier, not an automated diagnosis currently offered. An agent could match supplied evidence to reviewed runbooks, state its confidence and likely blast radius, and draft an explanation or quote. A person would review it before it reaches you.",
  },
  {
    title: "Approved fixes · tested runbooks",
    body: "A possible future tier requiring separate written, revocable authorisation for the named systems and actions. A person approves each change; tested code runs a named runbook, snapshots configuration first, checks the result, rolls back on failure, records an audit entry and can be stopped with a kill switch. The model never invents shell commands.",
  },
  {
    title: "Standing auto-fix · narrow whitelist",
    body: "Not available today. Any later version would require its own explicit written authorisation and could perform only named, reversible actions under daily caps, escalating after one failed attempt. It would first run in shadow mode; a runbook would need dozens of matching proposals with no harmful outcome before any promotion.",
  },
] as const;

const ALONE = [
  "Open a sale for someone who wrote in.",
  "Quote a published rate and email that quote.",
  "Mark the work won after the customer accepts it.",
  "Invoice the accepted work and match an exact payment.",
  "Start a published subscription and send the report.",
  "Brief the founder from the office's own records.",
];

const WAITS = [
  "Any single action over R5,000, or more than 20 actions in a day.",
  "A price that is not on the published card.",
  "A customer who never wrote in.",
  "Ending a subscription.",
  "Any cost: ads, hardware, a vendor, a carrier.",
  "Paying the founder. There is no remittance agent.",
];

const ECOSYSTEM = [
  {
    title: "Bounded operational loops",
    summary:
      "An automated workflow can handle routine intake, follow-up and recordkeeping when its data access, limits and escalation path are explicit.",
  },
  {
    title: "Specialist roles and approvals",
    summary:
      "Specialist agents can pass work between defined roles and stop at a human approval or policy gate. The pattern is useful only when the controls are testable.",
  },
] as const;

function ModelPage() {
  return (
    <PublicFrame>
      <section className="enter-up pb-12 pt-16 lg:pt-24">
        <p className="font-mono text-xs tracking-[0.22em] text-accent uppercase">The office</p>
        <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-[0.98] tracking-[-0.03em] sm:text-7xl">
          It runs itself. It does not spend itself.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Ten agents work a queue every ten minutes. For a person who actually wrote in, the office
          may quote a published rate, email them, and — once they accept — invoice, match an exact
          payment, and deliver. Anything over R5,000, ending a subscription, spending money, and
          paying the founder still wait.
        </p>
      </section>

      <section className="border-t border-border py-16" aria-labelledby="floor-heading">
        <h2 id="floor-heading" className="font-serif text-4xl tracking-[-0.03em] sm:text-5xl">
          Who does the work
        </h2>
        <p className="mt-4 max-w-2xl text-muted">
          Each agent has one department. SEAL can stop the others. The governor sits in front of
          every action.
        </p>
        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FLOOR.map(([sign, title, note], index) => (
            <li key={sign} className="panel rounded-2xl p-5">
              <p className="font-mono text-xs text-subtle">{String(index + 1).padStart(2, "0")}</p>
              <p className="mt-3 font-mono text-sm tracking-[0.16em] text-accent">{sign}</p>
              <h3 className="mt-1 font-serif text-2xl">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{note}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-border py-16" aria-labelledby="path-heading">
        <h2 id="path-heading" className="font-serif text-4xl tracking-[-0.03em] sm:text-5xl">
          From enquiry to a confirmed receipt
        </h2>
        <ol className="mt-8 grid gap-3 md:grid-cols-2">
          {PATH.map(([title, note], index) => (
            <li key={title} className="flex gap-4 border-b border-border py-4">
              <span className="font-mono text-sm text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <span className="block font-semibold text-fg">{title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">{note}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-muted">
          A payment notice on the site records a claim. It does not mark the invoice paid.
        </p>
      </section>

      <section className="border-t border-border py-16" aria-labelledby="ecosystem-heading">
        <h2 id="ecosystem-heading" className="font-serif text-4xl tracking-[-0.03em] sm:text-5xl">
          The autonomous enterprise pattern
        </h2>
        <p className="mt-4 max-w-2xl text-muted">
          This is the operating pattern that people mean when they talk about an AI-native company:
          specialist agents do the routine work, while the human founder stays in the approval lane.
        </p>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {ECOSYSTEM.map((item) => (
            <article key={item.title} className="panel rounded-2xl p-6">
              <h3 className="font-serif text-2xl text-fg">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-border py-16" aria-labelledby="authorized-heading">
        <h2 id="authorized-heading" className="font-serif text-4xl tracking-[-0.03em] sm:text-5xl">
          A path to authorised fault work
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">
          These are safeguards for a possible future service, not capabilities available today.
          Every tier would require a separate written authorisation naming its scope; customers
          could revoke it. Current plans do not include live monitoring or system changes. There is
          no uptime promise.
        </p>
        <ol className="mt-8 grid gap-4 md:grid-cols-2">
          {AUTHORIZED_TIERS.map((tier, index) => (
            <li key={tier.title} className="panel rounded-2xl p-6">
              <p className="font-mono text-xs text-accent">
                TIER {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 font-serif text-2xl">{tier.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{tier.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-sm leading-relaxed text-muted">
          Any implementation would keep credentials outside the model, using scoped, short-lived
          tokens from a vault. The honest boundary is: autonomous only inside written authorisation;
          no uptime promise.
        </p>
      </section>

      <section className="border-t border-border py-16" aria-labelledby="gates-heading">
        <h2 id="gates-heading" className="font-serif text-4xl tracking-[-0.03em] sm:text-5xl">
          What runs alone, and what waits
        </h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="panel rounded-2xl p-6">
            <h3 className="font-mono text-xs tracking-[0.18em] text-ok uppercase">
              Runs on the schedule
            </h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed">
              {ALONE.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="panel rounded-2xl p-6">
            <h3 className="font-mono text-xs tracking-[0.18em] text-accent uppercase">
              Stops for a decision
            </h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed">
              {WAITS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-8 text-sm text-muted">
          The published service lines, and the rates under them, are on{" "}
          <Link to="/services" className="text-accent underline-offset-4 hover:underline">
            Services
          </Link>{" "}
          and{" "}
          <Link to="/rates" className="text-accent underline-offset-4 hover:underline">
            Rates
          </Link>
          . AI workflow services have their own{" "}
          <Link
            to="/services/$slug"
            params={{ slug: "ai-automation" }}
            className="text-accent underline-offset-4 hover:underline"
          >
            scoped service page
          </Link>
          .
        </p>
      </section>
    </PublicFrame>
  );
}
