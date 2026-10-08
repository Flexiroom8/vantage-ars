import { formatZar } from "./money.ts";

export type QuoteLocation = "remote" | "onsite";

type QuoteSpec = {
  rateId: string;
  location: QuoteLocation;
  title: string;
  unit: "hour" | "point" | "flat";
  cents: number;
  min: number;
  step: number;
  note: string;
};

/** Single published figures only. Ranges, retainers, and supplier prices are refused. */
export const QUOTE_SPECS: QuoteSpec[] = [
  {
    rateId: "remote-support",
    location: "remote",
    title: "Remote technical support",
    unit: "hour",
    cents: 69000,
    min: 0.5,
    step: 0.25,
    note: "30-minute minimum, then 15-minute increments.",
  },
  {
    rateId: "onsite-support",
    location: "onsite",
    title: "On-site technical support",
    unit: "hour",
    cents: 80500,
    min: 2,
    step: 0.25,
    note: "Two-hour minimum. Travel is not included.",
  },
  {
    rateId: "after-hours",
    location: "remote",
    title: "After-hours support, remote",
    unit: "hour",
    cents: 103500,
    min: 0.25,
    step: 0.25,
    note: "1.5× remote labour. Not an emergency response.",
  },
  {
    rateId: "after-hours",
    location: "onsite",
    title: "After-hours support, on-site",
    unit: "hour",
    cents: 120750,
    min: 0.25,
    step: 0.25,
    note: "Published on-site after-hours labour. Travel is not included.",
  },
  {
    rateId: "assessment",
    location: "remote",
    title: "Initial remote assessment",
    unit: "flat",
    cents: 69000,
    min: 1,
    step: 1,
    note: "Up to 60 minutes. Chargeable unless a later quote credits it.",
  },
  {
    rateId: "survey",
    location: "onsite",
    title: "Site survey and written recommendation",
    unit: "hour",
    cents: 80500,
    min: 2,
    step: 0.25,
    note: "Two-hour minimum. Travel is not included.",
  },
  {
    rateId: "network-point",
    location: "onsite",
    title: "Structured network point",
    unit: "point",
    cents: 80500,
    min: 1,
    step: 1,
    note: "Labour per point. Materials are not included.",
  },
  {
    rateId: "voip-diagnosis",
    location: "remote",
    title: "VoIP fault diagnosis, remote",
    unit: "hour",
    cents: 69000,
    min: 0.25,
    step: 0.25,
    note: "Labour only. No restoration guarantee.",
  },
  {
    rateId: "voip-diagnosis",
    location: "onsite",
    title: "VoIP fault diagnosis, on-site",
    unit: "hour",
    cents: 80500,
    min: 0.25,
    step: 0.25,
    note: "Labour only. Travel is not included.",
  },
  {
    rateId: "pbx-design",
    location: "remote",
    title: "Hosted PBX / SIP design",
    unit: "hour",
    cents: 80500,
    min: 0.25,
    step: 0.25,
    note: "Design labour. Carrier, licences, and handsets are not included.",
  },
  {
    rateId: "pbx-install",
    location: "remote",
    title: "VoIP / PBX installation, remote",
    unit: "hour",
    cents: 69000,
    min: 0.25,
    step: 0.25,
    note: "Hourly labour. Not a fixed project price.",
  },
  {
    rateId: "pbx-install",
    location: "onsite",
    title: "VoIP / PBX installation, on-site",
    unit: "hour",
    cents: 80500,
    min: 0.25,
    step: 0.25,
    note: "Hourly labour. Not a fixed project price. Travel is not included.",
  },
  {
    rateId: "infra-assessment",
    location: "remote",
    title: "IT infrastructure assessment, remote",
    unit: "hour",
    cents: 69000,
    min: 0.25,
    step: 0.25,
    note: "Findings labour. Certification is not included.",
  },
  {
    rateId: "infra-assessment",
    location: "onsite",
    title: "IT infrastructure assessment, on-site",
    unit: "hour",
    cents: 80500,
    min: 2,
    step: 0.25,
    note: "Two-hour minimum on-site. Travel is not included.",
  },
  {
    rateId: "infra-change",
    location: "remote",
    title: "IT infrastructure implementation, remote",
    unit: "hour",
    cents: 69000,
    min: 0.25,
    step: 0.25,
    note: "Hourly labour. Hardware and licences are not included.",
  },
  {
    rateId: "infra-change",
    location: "onsite",
    title: "IT infrastructure implementation, on-site",
    unit: "hour",
    cents: 80500,
    min: 0.25,
    step: 0.25,
    note: "Hourly labour. Hardware, licences, and travel are not included.",
  },
];

export type QuotePrice =
  | { ok: true; cents: number; title: string; detail: string; body: string }
  | { ok: false; error: string };

export function priceQuote(input: {
  rateId: string;
  location: QuoteLocation;
  quantity: number;
}): QuotePrice {
  const spec = QUOTE_SPECS.find((item) => item.rateId === input.rateId && item.location === input.location);
  if (!spec) {
    return {
      ok: false,
      error: "That line has no single published figure. Ranges, retainers, travel, and supplier prices are not quoted here.",
    };
  }
  if (spec.unit === "flat") {
    return okPrice(spec, 1, spec.cents);
  }
  const quantity = input.quantity;
  if (!Number.isFinite(quantity) || quantity < spec.min || quantity > 40) {
    return { ok: false, error: `Quantity must be between ${spec.min} and 40.` };
  }
  const units = Math.round(quantity / spec.step);
  if (Math.abs(units * spec.step - quantity) > 0.001) {
    return { ok: false, error: `Use increments of ${spec.step}.` };
  }
  if (spec.unit === "point" && !Number.isInteger(quantity)) {
    return { ok: false, error: "Network points are whole numbers." };
  }
  return okPrice(spec, quantity, Math.round(quantity * spec.cents));
}

function okPrice(spec: QuoteSpec, quantity: number, cents: number): QuotePrice {
  const amount = formatZar(cents);
  const measure =
    spec.unit === "flat" ? "One assessment" : spec.unit === "point" ? `${quantity} point(s)` : `${quantity} hour(s)`;
  const detail = `${spec.title}. ${measure}. ${spec.note} Labour ${amount}.`;
  const body = [
    "INTERNAL QUOTE DRAFT. This has not been sent.",
    detail,
    "VAT treatment is not decided here.",
    "Managed support is not offered.",
  ].join(" ");
  return { ok: true, cents, title: spec.title, detail, body };
}
