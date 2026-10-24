import { COMPANY } from "@/lib/office/company";
import { PUBLISHED_RATES, ratePriceValue } from "@/lib/office/catalogue";

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
  const imageAlt = input.imageAlt ?? `Preview image for ${input.title}`;

  const meta: Meta[] = [
    { title: input.title },
    { name: "description", content: input.description },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:site_name", content: COMPANY.tradingName },
    { property: "og:title", content: input.title },
    { property: "og:description", content: input.description },
    { property: "og:url", content: url },
    { property: "og:image", content: image },
    { property: "og:image:alt", content: imageAlt },
    { property: "og:locale", content: "en_ZA" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: input.title },
    { name: "twitter:description", content: input.description },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: imageAlt },
    { name: "theme-color", content: "#f5f8f6" },
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
      { rel: "alternate", href: url, hrefLang: "en-ZA" } as unknown as Record<string, string>,
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
    logo: `${SITE_URL}/favicon.svg`,
    image: `${SITE_URL}/og.jpg`,
    priceRange: "R690–R3,450",
    currenciesAccepted: "ZAR",
    paymentAccepted: "EFT, international wire",
    address: { "@type": "PostalAddress", addressCountry: "ZA" },
    areaServed: "Worldwide (remote); on-site by arrangement",
    knowsAbout: [
      "VoIP",
      "PBX",
      "SIP",
      "Networking",
      "Wi-Fi",
      "VLAN",
      "IT infrastructure",
      "AI workflow automation",
      "Human-reviewed agent pilots",
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        areaServed: "ZA",
        availableLanguage: ["English"],
      },
    ],
    sameAs: [SITE_URL, `${SITE_URL}/support`, `${SITE_URL}/rates`],
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

/**
 * A breadcrumb trail as schema.org data. Every public page that shows a
 * breadcrumb should emit the same trail; search engines read this rather than
 * guessing the hierarchy from links.
 */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path === "/" ? "/" : item.path}`,
    })),
  });
}

/**
 * The published rate card as an OfferCatalog. Only offered lines with a real
 * figure are emitted: a withheld or supplier-quoted line is not a price.
 *
 * `rateIds` narrows the catalogue to the lines a single service page shows,
 * so the page's structured data matches what a visitor can actually read.
 */
export function offerCatalogJsonLd(
  options: {
    name?: string;
    path?: string;
    rateIds?: readonly string[];
  } = {},
) {
  const wanted = options.rateIds ? new Set(options.rateIds) : null;
  const offers = PUBLISHED_RATES.filter(
    (rate) => rate.offered && (!wanted || wanted.has(rate.id)),
  ).flatMap((rate) => {
    const price = ratePriceValue(rate.id);
    if (!price) return [];
    return [
      {
        "@type": "Offer",
        name: rate.title,
        description: rate.scope,
        price,
        priceCurrency: "ZAR",
        url: `${SITE_URL}/rates`,
        availability: "https://schema.org/InStock",
        seller: { "@type": "ProfessionalService", name: COMPANY.tradingName, url: SITE_URL },
      },
    ];
  });

  return jsonLd({
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: options.name ?? "Published rates",
    url: `${SITE_URL}${options.path ?? "/rates"}`,
    numberOfItems: offers.length,
    itemListElement: offers,
  });
}
