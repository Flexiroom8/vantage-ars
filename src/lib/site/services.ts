/**
 * Public service pages. Every published price and limit comes from the
 * catalogue (`@/lib/office/catalogue`); unpriced project work is quoted.
 */
import { rateAmountLabel } from "@/lib/office/catalogue";

export type ServicePage = {
  slug:
    | "voip"
    | "networking"
    | "it-infrastructure"
    | "ai-automation"
    | "managed-support"
    | "cloud-email"
    | "security"
    | "backup-recovery";
  number: string;
  title: string;
  metaTitle: string;
  description: string;
  lead: string;
  symptoms: string[];
  approach: { title: string; body: string }[];
  rateIds: string[];
  products?: { title: string; suitableWhen: string; deliverable: string }[];
  /** Overrides the shared "Not in the labour rate" heading where it would be wrong. */
  excludedTitle?: string;
  excluded: string[];
  faqs: { q: string; a: string }[];
};

export const SERVICE_PAGES: ServicePage[] = [
  {
    slug: "voip",
    number: "01",
    title: "VoIP & telecoms",
    metaTitle: "VoIP & phone system support · Vantage-ARS",
    description:
      "Dropped calls, one-way audio and handsets that will not register. Remote VoIP fault diagnosis from R690 an hour, with a written quote before work starts.",
    lead: "When calls drop, sound goes one way, or handsets will not register, the fault is usually in the phone, the network between, or the system the call depends on. We work through those in order.",
    symptoms: [
      "Calls drop after a set time or at random",
      "One-way or choppy audio",
      "Handsets or softphones that will not register",
      "No dial tone after a router or ISP change",
      "Moving to a hosted PBX or SIP trunk and needing a plan",
    ],
    approach: [
      {
        title: "Diagnose remotely first",
        body: "We check endpoint and network symptoms and the call-path information you can provide. Many faults can be narrowed down without a site visit.",
      },
      {
        title: "Quote the fix in writing",
        body: "Once the cause is clear you get a written quote: scope, hours, and whether VAT applies. Nothing starts until you accept it.",
      },
      {
        title: "Configure and test",
        body: "Customer-approved hosted or on-premises systems are configured, extensions and routing set, and the agreed tests run.",
      },
    ],
    rateIds: ["voip-diagnosis", "pbx-design", "pbx-install", "remote-support", "onsite-support"],
    excluded: [
      "Carrier access or a guarantee that a carrier service is restored",
      "Hosted PBX, SIP trunk, call usage, number porting and handsets (third-party, itemised in advance)",
      "Unsupported platforms",
    ],
    faqs: [
      {
        q: "Can you fix it without coming on site?",
        a: "Often, yes. Remote support is R690 an hour with a 30-minute minimum. If someone needs to be there, on-site work is R805 an hour and travel is quoted before booking.",
      },
      {
        q: "Do you sell phone lines or a PBX?",
        a: "No. Carrier services, licences and handsets come from suppliers and are itemised in the quote. We design, configure and test.",
      },
    ],
  },
  {
    slug: "networking",
    number: "02",
    title: "Networking",
    metaTitle: "Network & Wi-Fi setup and support · Vantage-ARS",
    description:
      "Router, switch, Wi-Fi and VLAN configuration, structured network points and network faults. Small-job estimates from R1,380, fixed after a written quote.",
    lead: "Slow or patchy Wi-Fi, devices that cannot see each other, or a network that grew without a plan. We configure what you have, add cable points where they are needed, and write down what was done.",
    symptoms: [
      "Wi-Fi that drops or is slow in parts of the building",
      "A new router, switch or access point to configure",
      "Separating guest, staff or phone traffic (VLANs)",
      "Adding wired network points",
      "Devices that cannot reach printers, servers or each other",
    ],
    approach: [
      {
        title: "Understand the layout",
        body: "Device count, access, topology and acceptance checks decide the price. Remote review first; a site survey when the building matters.",
      },
      {
        title: "Fix the price",
        body: "Typical small jobs fall between R1,380 and R3,450. The written quote fixes the fee before work starts.",
      },
      {
        title: "Configure, test, hand over",
        body: "Routers, switches, Wi-Fi, VLANs and addressing are configured and tested against the agreed checks.",
      },
    ],
    rateIds: ["network-setup", "network-point", "survey", "remote-support", "onsite-support"],
    excluded: [
      "Hardware and travel (quoted separately)",
      "Cable, conduit, drilling, patch panels, ceiling access and building work for network points",
      "Drawings, certification and third-party fees unless listed in the quote",
    ],
    faqs: [
      {
        q: "What does a network point cost?",
        a: "R805 per point for labour: install and test one cable point up to 20 m from the hub, where site conditions permit. Materials and building work are quoted separately.",
      },
      {
        q: "Do I need a site survey?",
        a: "Only when the building affects the work. A survey is R805 an hour, two-hour minimum plus approved travel, and ends with a priced recommendation.",
      },
    ],
  },
  {
    slug: "it-infrastructure",
    number: "03",
    title: "IT infrastructure",
    metaTitle: "IT infrastructure assessment & changes · Vantage-ARS",
    description:
      "Server, network and connectivity reviews and defined infrastructure changes with rollback steps. From R690 an hour remote, fixed after discovery.",
    lead: "The servers, connectivity and supporting setup your business depends on. We review a defined set of components, tell you what matters most, and carry out agreed changes with a way back.",
    symptoms: [
      "Nobody is sure how the current setup fits together",
      "A server, connectivity or infrastructure change is due",
      "Recurring outages without a clear cause",
      "Planning an upgrade and needing a prioritised list",
    ],
    approach: [
      {
        title: "Assess",
        body: "A review of a defined set of existing network and IT components, ending in a prioritised findings report.",
      },
      {
        title: "Plan the change",
        body: "Each change has rollback and acceptance steps. Hardware, licences and vendor fees are separated in the quote.",
      },
      { title: "Implement", body: "R690 an hour remote or R805 on-site, fixed after discovery." },
    ],
    rateIds: [
      "infra-assessment",
      "infra-change",
      "remote-support",
      "onsite-support",
      "after-hours",
    ],
    excluded: [
      "Penetration testing and compliance certification",
      "Hardware, licences, vendor fees and out-of-scope remediation (separated in the quote)",
      "Live monitoring of your estate, an uptime promise and a contractual service level (none of these are offered)",
    ],
    faqs: [
      {
        q: "Do you offer monthly managed support?",
        a: "Yes. The managed support plan is a fixed monthly price, remote only, with a written report every month. There is still no live monitoring of your estate, no uptime promise and no contractual service level. The plan and its prices are on the managed services page.",
      },
      {
        q: "Can work be done after hours?",
        a: "By appointment, at 1.5× labour: R1,035 an hour remote or R1,207.50 on-site. It is not an emergency response guarantee.",
      },
    ],
  },
  {
    slug: "managed-support",
    number: "04",
    title: "Managed services",
    metaTitle: "Managed services & monthly support plans · Vantage-ARS",
    description: `Monthly remote support, a written report every month and a quarterly review. The managed support plan is ${rateAmountLabel("managed-support")} a month, remote only, with no uptime promise.`,
    lead: "Not every job should need a ticket and a chase. The managed plan is remote support time each month, a written report on what we have actually done, and a quarterly look at the setup. The price is published, the scope is written down, and it stays the same every month.",
    symptoms: [
      "Faults are raised, but nothing moves until somebody chases it",
      "Nobody is sure what was invoiced, or which quote it came from",
      "Every new person starts without knowing how the setup fits together",
      "Continuity planning that exists in somebody's head only",
      "A support budget that needs a known monthly figure",
    ],
    approach: [
      {
        title: "Agree the month in writing",
        body: "The plan covers eight included remote support hours a month, a managed service report every month and a quarterly infrastructure review. The monthly fee is fixed and published, and what it includes is written down before the first month starts.",
      },
      {
        title: "Work the faults as they arrive",
        body: "Raise a fault and it is triaged without you chasing us. Our target for the plan is a first response on P2 faults within four working hours. That is a working target we measure ourselves against, not a contractual service level.",
      },
      {
        title: "Report from our own records",
        body: "Each monthly report lists the faults raised, the quotes issued, the invoices raised and what is still open. It is compiled from what we have actually recorded for you, not from a template.",
      },
    ],
    rateIds: [
      "managed-support",
      "health-watch",
      "service-report",
      "billing-audit",
      "handover-pack",
      "continuity-plan",
      "sla-review",
    ],
    excludedTitle: "Not included in the monthly price",
    excluded: [
      "Live monitoring of your estate, an uptime promise and a contractual service level",
      "On-site work, hardware, third-party licences and carrier costs",
      "After-hours work, which is quoted separately",
    ],
    faqs: [
      {
        q: "Is there an SLA or an uptime promise?",
        a: "No. There is no uptime promise, no contractual service level and no cover outside our working hours. We publish our response targets, measure ourselves against them and report the result in writing.",
      },
      {
        q: "Can I buy a report without the plan?",
        a: `Yes. The reports and reviews are separate products: a service report is ${rateAmountLabel("service-report")}, a billing audit ${rateAmountLabel("billing-audit")}, a handover pack ${rateAmountLabel("handover-pack")}, a continuity plan ${rateAmountLabel("continuity-plan")} and a service level review ${rateAmountLabel("sla-review")}. Each one is ordered on its own.`,
      },
      {
        q: "Is on-site work part of the plan?",
        a: "No. The plan is remote only. On-site work is quoted separately at the published on-site rate, and travel is agreed before anyone is booked.",
      },
    ],
  },
  {
    slug: "cloud-email",
    number: "05",
    title: "Cloud & email",
    metaTitle: "Microsoft 365, Google Workspace & email support · Vantage-ARS",
    description:
      "Mail flow, deliverability, users, shared mailboxes and identity for Microsoft 365 and Google Workspace. Remote administration from R690 an hour.",
    lead: "Cloud mail and identity are easy to set up and hard to keep tidy. We work on the tenant you already have: users, groups, shared mailboxes, mail flow, authentication and the administrator access around them.",
    symptoms: [
      "Mail that is delayed, rejected or lands in spam",
      "A new starter, leaver or shared mailbox to configure",
      "MFA, password resets or administrator access that needs repair",
      "Mail flow rules that nobody can explain any more",
      "A tenant that grew without a naming or access plan",
    ],
    approach: [
      {
        title: "Check the tenant and the domain",
        body: "We look at the records, mail flow, authentication and the access you can lawfully provide. We do not ask for passwords in a message.",
      },
      {
        title: "Fix or change what was agreed",
        body: "The written quote names the users, mailboxes, rules and checks in scope. Licence and vendor fees are separate.",
      },
      {
        title: "Test and hand over",
        body: "Agreed checks are run after the change, and the result is recorded in the completion note.",
      },
    ],
    rateIds: ["cloud-admin", "remote-support", "security-baseline"],
    excluded: [
      "Microsoft 365, Google Workspace or other licence fees",
      "Mailbox data recovery and vendor-side restoration guarantees",
      "Vendor support that only the provider can give",
      "A 24/7 response or an uptime promise",
    ],
    faqs: [
      {
        q: "Do you resell Microsoft 365 or Google Workspace?",
        a: "No. You keep your own tenant and licences. We administer what you already own, and any licence or vendor charge stays on your account and is itemised separately.",
      },
      {
        q: "Can you recover a deleted mailbox?",
        a: "We can check the recovery options your provider exposes, but we do not promise data recovery. Mailbox restoration is a separate, explicitly quoted job, and the provider may charge for it.",
      },
      {
        q: "How is this priced?",
        a: `Cloud and email administration is ${rateAmountLabel("cloud-admin")} an hour remote, with a 30-minute minimum and then 15-minute increments. A security baseline review is a separate fixed ${rateAmountLabel("security-baseline")} review.`,
      },
    ],
  },
  {
    slug: "security",
    number: "06",
    title: "Security & continuity",
    metaTitle: "Security baseline & continuity review · Vantage-ARS",
    description: `A written review of identity, email authentication, administrator access, endpoint protection and backup readiness. Fixed ${rateAmountLabel("security-baseline")}, with no penetration testing.`,
    lead: "Most small offices do not need a security programme. They need to know which basic controls are missing, which ones are untested, and what to fix first. We review the controls we can see and write down the gaps.",
    symptoms: [
      "MFA is on for some accounts but nobody knows which",
      "Email authentication was set up once and never checked",
      "Too many people hold administrator access",
      "A backup runs, but nobody has tested a restore",
      "A continuity plan exists only in somebody's head",
    ],
    approach: [
      {
        title: "Agree the baseline",
        body: "We name the controls in scope: identity, email authentication, administrator access, endpoint protection and backup readiness.",
      },
      {
        title: "Review what is actually configured",
        body: "We check the configuration you can lawfully show us. This is a baseline review, not penetration testing or forensic work.",
      },
      {
        title: "Report the gaps in order",
        body: "You get a prioritised written report. Remediation is separate new work, quoted before anything changes.",
      },
    ],
    rateIds: ["security-baseline", "backup-review", "continuity-plan", "remote-support"],
    excludedTitle: "Not what this review is",
    excluded: [
      "Penetration testing, vulnerability exploitation or forensic investigation",
      "A compliance certification or a legal opinion",
      "Incident response, security operations or 24/7 monitoring",
      "Remediation work, which is quoted separately",
    ],
    faqs: [
      {
        q: "Is this a penetration test?",
        a: "No. A baseline review checks written controls and configuration against a baseline. It does not test, exploit or certify anything, and we do not sell penetration testing.",
      },
      {
        q: "Will you tell us what to fix first?",
        a: `Yes. The fixed ${rateAmountLabel("security-baseline")} review ends with a prioritised findings report. Anything that needs changing is new work, quoted separately and approved before it starts.`,
      },
      {
        q: "Can you handle the backups too?",
        a: `The backup and recovery readiness review is a separate fixed ${rateAmountLabel("backup-review")} review. It reports what exists, what has been tested and what is missing; it does not guarantee that data can be recovered.`,
      },
    ],
  },
  {
    slug: "backup-recovery",
    number: "07",
    title: "Backup & recovery",
    metaTitle: "Backup & recovery readiness review · Vantage-ARS",
    description:
      "A written review of what is backed up, what has been tested, and what is missing. Fixed R1,380. No data recovery guarantee and no monitoring promise.",
    lead: "A backup is not a recovery plan. We review what you say is protected, whether a restore has actually been tested, and what the record cannot show. The result is a short written gap list, not a promise that data can be recovered.",
    symptoms: [
      "A backup job reports success, but no restore has been tried",
      "Nobody can say which systems and data are actually covered",
      "Backups live on the same device or in the same building as the originals",
      "The recovery steps are known by one person",
      "A continuity plan has never been written down",
    ],
    approach: [
      {
        title: "List what is protected",
        body: "We record the systems, data and accounts you say are covered, and where the copies live.",
      },
      {
        title: "Check the restore path",
        body: "We review whether a restore has been tested and what the evidence shows. We do not perform a recovery as part of the review.",
      },
      {
        title: "Name the gaps",
        body: "You get a written list of what exists, what is untested and what is missing, ordered by the risk the record shows.",
      },
    ],
    rateIds: ["backup-review", "continuity-plan", "remote-support", "onsite-support"],
    excludedTitle: "What this review does not include",
    excluded: [
      "Data recovery, restoration or a guarantee that data can be recovered",
      "Backup software, storage, hardware or offsite services",
      "Building and testing a new backup system, which is quoted separately",
      "Live monitoring of your backups or an uptime promise",
    ],
    faqs: [
      {
        q: "Will you recover our data if it is lost?",
        a: "No. This review reports on the recovery path; it does not recover data and does not guarantee recoverability. Recovery is a separate job, quoted after the facts are known.",
      },
      {
        q: "What do we receive?",
        a: `A written review listing the systems and data you say are covered, whether a restore has been tested, and the gaps the record shows. It is a fixed ${rateAmountLabel("backup-review")} review.`,
      },
      {
        q: "Can you write the continuity plan as well?",
        a: `Yes. The business continuity plan is a separate ${rateAmountLabel("continuity-plan")} product, built from the faults and open items already on your record. It is not a formal disaster recovery certification.`,
      },
    ],
  },
  {
    slug: "ai-automation",
    number: "08",
    title: "AI workflow automation",
    metaTitle: "AI workflow automation & agent pilots · Vantage-ARS",
    description:
      "Human-led workflow discovery, AI agent blueprints, supervised pilots and governance controls. Each engagement is scoped and quoted before work starts.",
    lead: "Turn a repeated business process into a carefully scoped automation opportunity. A Vantage-ARS engineer maps the workflow, information access, exceptions and approval points, then recommends whether to automate, assist or leave it with a person. Any pilot starts in a bounded, reviewable mode.",
    symptoms: [
      "Staff repeat the same intake, classification or record-updating steps",
      "Important decisions depend on scattered documents or unclear ownership",
      "An AI assistant or agent is being considered but its access and limits are not defined",
      "A small automation pilot needs measurable checks, human review and a way to stop",
    ],
    approach: [
      {
        title: "Understand one workflow",
        body: "Map its trigger, steps, data, exceptions, owners and the cost of a mistake. Use permissioned, minimised examples; do not send passwords or sensitive customer records in an enquiry.",
      },
      {
        title: "Design the boundary",
        body: "Define allowed inputs and actions, human approval points, evaluation cases, cost limits, logs and a tested rollback or stop path before implementation is considered.",
      },
      {
        title: "Pilot under review",
        body: "Where suitable, begin in a test environment with read-only analysis or drafts for a named person to review. Production access or autonomous actions need their own written scope and customer approval.",
      },
    ],
    products: [
      {
        title: "Workflow automation readiness review",
        suitableWhen: "You have one process in mind but do not know whether AI is the right fit.",
        deliverable:
          "A current-state workflow map, data and exception inventory, risk notes, measurable baseline and a written automate / assist / do-not-automate recommendation.",
      },
      {
        title: "AI workflow and agent blueprint",
        suitableWhen:
          "The process is understood and you need a design before selecting or changing tools.",
        deliverable:
          "A bounded design covering components, data access, permitted tools, human approval gates, failure handling, evaluation cases, estimated operating costs and rollback.",
      },
      {
        title: "Supervised workflow pilot",
        suitableWhen: "A low-impact workflow is ready to be tested with real acceptance checks.",
        deliverable:
          "A narrowly scoped proof of concept in an agreed test environment, initially limited to read-only results or human-reviewed drafts, with test evidence and a handover.",
      },
      {
        title: "Read-only AI diagnostics pilot",
        suitableWhen:
          "You want AI to summarize a specific set of authorized system health data or diagnostic records.",
        deliverable:
          "A bounded test using customer-approved read-only telemetry or exported records, with findings linked to their evidence, stated uncertainty and coverage gaps. It does not scan or change customer systems.",
      },
      {
        title: "Agent governance and operations pack",
        suitableWhen:
          "You already use an assistant or agent and need clearer operational controls.",
        deliverable:
          "A practical inventory of agent roles and access, approval rules, logging and retention expectations, spend thresholds, escalation contacts and a stop procedure.",
      },
    ],
    rateIds: ["remote-support", "onsite-support", "infra-assessment"],
    excludedTitle: "Boundaries and exclusions",
    excluded: [
      "Unattended decisions involving safety, legal rights, employment, credit or significant financial consequences",
      "Penetration testing, compliance certification, legal advice or a guarantee that an AI system is accurate",
      "Third-party model, cloud, API or software subscription charges; these remain separately disclosed and customer-approved",
      "Production integrations, ongoing monitoring or operational support unless each is separately scoped and agreed",
      "Connecting to or scanning a customer system without explicit written authorization and a defined target scope",
      "Sharing passwords, API keys, personal data or confidential records through the public enquiry form",
    ],
    faqs: [
      {
        q: "Do you deploy autonomous AI agents into production?",
        a: "Not by default. Each engagement starts with a written scope. Suitable pilots begin in a bounded test environment or in read-only / draft mode with a named human reviewer. Production access and any autonomous action require a separate, explicit customer-approved scope.",
      },
      {
        q: "How is AI automation work priced?",
        a: "There is no universal fixed price because data access, integrations, testing and risk vary. The discovery and project scope are quoted in writing using the applicable published remote or on-site labour rate. Third-party software and model charges are disclosed separately before commitment.",
      },
      {
        q: "Can you certify our AI system or provide 24/7 agent monitoring?",
        a: "No. A governance pack is practical operational documentation, not a legal opinion, compliance certification, penetration test or continuous monitoring service.",
      },
    ],
  },
];

export function servicePage(slug: string): ServicePage | undefined {
  return SERVICE_PAGES.find((page) => page.slug === slug);
}
