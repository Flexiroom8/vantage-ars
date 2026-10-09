import { COMPANY } from "@/lib/office/company";

export const SITE_URL = `https://${COMPANY.domain}`;

type Meta = { title?: string; name?: string; property?: string; content?: string };

/** Title, description, canonical and share-card tags for a public page. */
export function pageHead(input: { title: string; description: string; path: string; type?: "website" | "article" }) {
  const url = `${SITE_URL}${input.path === "/" ? "/" : input.path}`;
  const meta: Meta[] = [
    { title: input.title },
    { name: "description", content: input.description },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:site_name", content: COMPANY.tradingName },
    { property: "og:title", content: input.title },
    { property: "og:description", content: input.description },
    { property: "og:url", content: url },
    { property: "og:image", content: `${SITE_URL}/og.jpg` },
    { property: "og:locale", content: "en_ZA" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: input.title },
    { name: "twitter:description", content: input.description },
    { name: "twitter:image", content: `${SITE_URL}/og.jpg` },
  ];
  return { meta, links: [{ rel: "canonical", href: url }] };
}

/** JSON-LD block for the head. Data only; never executed. */
export function jsonLd(data: Record<string, unknown>) {
  return { type: "application/ld+json", children: JSON.stringify(data) };
}

export function businessJsonLd() {
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: COMPANY.tradingName,
    url: SITE_URL,
    email: COMPANY.email,
    image: `${SITE_URL}/og.jpg`,
    priceRange: "R690–R3,450",
    currenciesAccepted: "ZAR",
    paymentAccepted: "EFT, international wire",
    address: { "@type": "PostalAddress", addressCountry: "ZA" },
    areaServed: "Worldwide (remote); on-site by arrangement",
    knowsAbout: ["VoIP", "PBX", "SIP", "Networking", "Wi-Fi", "VLAN", "IT infrastructure"],
  });
}

export function faqJsonLd(faqs: { q: string; a: string }[]) {
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  });
}
