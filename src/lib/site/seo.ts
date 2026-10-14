import { COMPANY } from "@/lib/office/company";

export const SITE_URL = `https://${COMPANY.domain}`;

type Meta = { title?: string; name?: string; property?: string; content?: string };

/**
 * Title, description, canonical and share-card tags for a public page.
 * Accepts optional overrides for image, type and author metadata to support richer SEO.
 */
export function pageHead(input: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  image?: string;
  imageAlt?: string;
  authorName?: string;
}) {
  const pathname = input.path === "/" ? "/" : input.path.replace(/^(?!\/)/, "/");
  const url = `${SITE_URL}${pathname}`;
  const image = input.image ?? `${SITE_URL}/og.jpg`;

  const meta: Meta[] = [
    { title: input.title },
    { name: "description", content: input.description },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:site_name", content: COMPANY.tradingName },
    { property: "og:title", content: input.title },
    { property: "og:description", content: input.description },
    { property: "og:url", content: url },
    { property: "og:image", content: image },
    { property: "og:locale", content: "en_ZA" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: input.title },
    { name: "twitter:description", content: input.description },
    { name: "twitter:image", content: image },
    { name: "theme-color", content: "#0e1c33" },
    { name: "robots", content: "index,follow" },
  ];

  if (input.authorName) {
    meta.push({ name: "author", content: input.authorName });
    meta.push({ name: "twitter:creator", content: input.authorName });
  }

  return {
    meta,
    links: [
      { rel: "canonical", href: url },
      { rel: "alternate", href: SITE_URL, hrefLang: "en-ZA" } as unknown as Record<string, string>,
    ],
  };
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
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: "",
        contactType: "customer support",
        areaServed: "ZA",
        availableLanguage: ["English"],
      },
    ],
    sameAs: [
      // Add social/profile links here when available
    ],
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
