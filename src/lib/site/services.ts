/**
 * Public service pages. Every price and limit here comes from the published
 * catalogue (`@/lib/office/catalogue`); nothing new is promised.
 */
import { rateAmountLabel } from "@/lib/office/catalogue";

export type ServicePage = {
  slug: "voip" | "networking" | "it-infrastructure" | "managed-support";
  number: string;
  title: string;
  metaTitle: string;
  description: string;
  lead: string;
  symptoms: string[];
  approach: { title: string; body: string }[];
  rateIds: string[];
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
];

export function servicePage(slug: string): ServicePage | undefined {
  return SERVICE_PAGES.find((page) => page.slug === slug);
}
