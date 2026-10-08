export type PublishedRate = {
  id: string;
  title: string;
  scope: string;
  price: string;
  basis: string;
  offered: boolean;
};

/** Customer-facing ZAR rates published for vantage-ars.co.za. Researched 2 October 2026. */
export const PUBLISHED_RATES: PublishedRate[] = [
  {
    id: "remote-support",
    title: "Remote technical support",
    scope: "Troubleshoot one VoIP, network, or infrastructure issue and document findings.",
    price: "R690 / hour",
    basis: "Worldwide remote. 30-minute minimum, then 15-minute increments. Final quote states VAT treatment.",
    offered: true,
  },
  {
    id: "onsite-support",
    title: "On-site technical support",
    scope: "Diagnose and resolve an in-scope VoIP, network, or infrastructure issue at the customer site.",
    price: "R805 / hour",
    basis: "Worldwide by arrangement. Two-hour minimum. Travel and local costs quoted before booking.",
    offered: true,
  },
  {
    id: "after-hours",
    title: "After-hours support",
    scope: "Work agreed outside the published normal-hours window.",
    price: "R1,035 / hour remote",
    basis: "1.5× labour. On-site R1,207.50 / hour. By appointment. Not an emergency response guarantee.",
    offered: true,
  },
  {
    id: "assessment",
    title: "Initial remote assessment",
    scope: "Up to 60 minutes to establish the issue, risks, and likely next action.",
    price: "R690",
    basis: "Remains chargeable unless a written follow-on quote explicitly credits it.",
    offered: true,
  },
  {
    id: "survey",
    title: "Site survey and written recommendation",
    scope: "On-site discovery, current-state notes, constraints, and a priced recommendation.",
    price: "R805 / hour",
    basis: "Two-hour minimum plus approved travel. Drawings, certification, and third-party fees excluded unless listed.",
    offered: true,
  },
  {
    id: "network-setup",
    title: "Network setup or configuration",
    scope: "Router, switch, Wi-Fi, VLAN, addressing, or basic connectivity configuration.",
    price: "R1,380–R3,450",
    basis: "Typical small-job estimate only. Fixed fee after device count, access, topology, and acceptance checks. Hardware and travel extra.",
    offered: true,
  },
  {
    id: "network-point",
    title: "Structured network point",
    scope: "Install and test one cable point, up to 20 m from the hub, where site conditions permit.",
    price: "R805 / point",
    basis: "Labour only. Cable, conduit, drilling, patch panel, ceiling access, and remedial building work quoted separately.",
    offered: true,
  },
  {
    id: "voip-diagnosis",
    title: "VoIP fault diagnosis and call-quality review",
    scope: "Check endpoint and network symptoms and the call-path information the customer can provide.",
    price: "R690 / hour remote",
    basis: "On-site R805 / hour. Labour only. No carrier access or restoration guarantee.",
    offered: true,
  },
  {
    id: "pbx-design",
    title: "Hosted PBX / SIP design and migration plan",
    scope: "Requirements, extension and channel sizing, routing plan, number-porting checklist, and an implementation quote.",
    price: "R805 / hour",
    basis: "Fixed scope after discovery. Carrier, licence, usage, numbers, handsets, and porting are third-party and itemised.",
    offered: true,
  },
  {
    id: "pbx-install",
    title: "VoIP / PBX installation and configuration",
    scope: "Configure a customer-approved hosted or on-premises phone system, extensions, routing, and agreed tests.",
    price: "From R690 / hour",
    basis: "R805 / hour on-site or R690 / hour remote. Fixed project quote after survey. Unsupported platforms excluded.",
    offered: true,
  },
  {
    id: "infra-assessment",
    title: "IT infrastructure assessment",
    scope: "Review a defined set of existing network and IT components and provide a prioritised findings report.",
    price: "From R690 / hour",
    basis: "R805 / hour on-site or R690 / hour remote. Two-hour minimum on-site. Penetration testing and compliance certification excluded.",
    offered: true,
  },
  {
    id: "infra-change",
    title: "IT infrastructure implementation",
    scope: "A defined server, network, connectivity, or infrastructure change with rollback and acceptance steps.",
    price: "R690–R805 / hour",
    basis: "By work location. Fixed quote after discovery. Hardware, licences, vendor fees, and out-of-scope remediation separated.",
    offered: true,
  },
  {
    id: "retainer",
    title: "Managed support retainer",
    scope: "Recurring support, monitoring, maintenance, and reporting.",
    price: "Not offered",
    basis: "No recurring package, monitoring promise, or SLA is published.",
    offered: false,
  },
  {
    id: "third-party",
    title: "Hardware, software, and carrier services",
    scope: "Third-party products or services needed for an approved job.",
    price: "Supplier quotation",
    basis: "Not included in labour. Itemised in advance. Founder and customer approval precede commitment.",
    offered: true,
  },
  {
    id: "travel",
    title: "Travel",
    scope: "Travel to an approved site.",
    price: "Agreed cost",
    basis: "Disclosed before booking. International travel, accommodation, visas, and local expenses quoted separately.",
    offered: true,
  },
];

export const SERVICE_LINES = [
  {
    number: "01",
    title: "VoIP & telecoms",
    summary: "Dropped calls, one-way audio, and phone systems that will not register.",
    price: "From R690 / hour",
  },
  {
    number: "02",
    title: "Networking",
    summary: "Wi-Fi, switches, and the connection between your people and the systems they use.",
    price: "From R690 / hour",
  },
  {
    number: "03",
    title: "IT infrastructure",
    summary: "Servers and the rest of the setup your business depends on.",
    price: "From R690 / hour",
  },
] as const;

export const PUBLIC_RATE_IDS = [
  "remote-support",
  "onsite-support",
  "after-hours",
  "network-setup",
  "network-point",
  "survey",
  "pbx-install",
  "infra-assessment",
] as const;

export function ratesByIds(ids: readonly string[]) {
  return ids
    .map((id) => PUBLISHED_RATES.find((rate) => rate.id === id))
    .filter((rate): rate is PublishedRate => Boolean(rate));
}

export function publicRateRows() {
  return ratesByIds(PUBLIC_RATE_IDS);
}

export const RATE_GROUPS = [
  {
    title: "Labour",
    note: "Charged by time. A written quote states the hours and the VAT treatment.",
    ids: ["remote-support", "onsite-support", "after-hours", "assessment", "voip-diagnosis"],
  },
  {
    title: "Quoted work",
    note: "A fixed figure only after the site, the devices, and the scope are known.",
    ids: ["survey", "network-setup", "network-point", "pbx-design", "pbx-install", "infra-assessment", "infra-change"],
  },
  {
    title: "Outside the labour rate",
    note: "These are not included in an hourly rate, and one of them is not offered at all.",
    ids: ["retainer", "third-party", "travel"],
  },
] as const;
