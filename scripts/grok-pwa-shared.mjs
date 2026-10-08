/**
 * PWA + OG helpers shared by the deployed-app middleware
 * (server/middleware/grok-pwa.ts) and its tests. Dependency-free so
 * both Node and the Nitro runtime can import them.
 */

/**
 * True when the client accepts HTML (browsers send it; API clients
 * and fetchers generally do not).
 */
export function acceptsHtml(header) {
  if (typeof header !== "string" || !header) return false;
  return header
    .split(",")
    .map((entry) => entry.split(";")[0].trim().toLowerCase())
    .includes("text/html");
}

/**
 * True for paths that serve an HTML document: no file extension, or
 * a `.html`/`.htm` extension. Asset paths (`.js`, `.css`, `.png`,
 * …) are not documents.
 */
export function isDocumentPath(pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return false;
  const clean = pathname.split("?")[0].split("#")[0];
  const base = clean.split("/").pop() ?? "";
  if (!base) return true; // trailing slash → directory index
  if (/\.(html?|xhtml)$/i.test(base)) return true;
  return !/\.[a-z0-9]+$/i.test(base);
}

/** True for `?install=1` (any platform value) on a document path. */
export function isInstallQuery(search) {
  if (typeof search !== "string" || !search) return false;
  const params = new URLSearchParams(search);
  return params.get("install") === "1";
}

/**
 * Streaming `</head>` injector. Buffers nothing: each pushed chunk
 * is scanned for `</head>`; the meta/link block is inserted before
 * the first occurrence and every byte passes through unchanged.
 */
export function createHeadInjector({ host, site }) {
  const block = headBlock({ host, site });
  let injected = false;
  let carry = Buffer.alloc(0);

  return {
    push(chunk) {
      const outputs = [];
      if (injected) {
        outputs.push(carry, Buffer.from(chunk));
        carry = Buffer.alloc(0);
        return outputs;
      }
      let data = Buffer.concat([carry, Buffer.from(chunk)]);
      const index = findHeadClose(data);
      if (index === -1) {
        // Keep the last `</hea`-prefix bytes so a split marker still
        // matches across chunks (7 bytes covers "</head>" minus one).
        carry = data.subarray(Math.max(0, data.length - 7));
        outputs.push(data.subarray(0, Math.max(0, data.length - 7)));
        return outputs;
      }
      injected = true;
      outputs.push(data.subarray(0, index), Buffer.from(block), data.subarray(index));
      carry = Buffer.alloc(0);
      return outputs;
    },
    flush() {
      const outputs = [];
      if (carry.length) outputs.push(carry);
      if (!injected) outputs.push(Buffer.from(block)); // no </head> found: append
      carry = Buffer.alloc(0);
      return outputs;
    },
  };
}

function findHeadClose(data) {
  const marker = Buffer.from("</head", "ascii");
  const index = data.indexOf(marker);
  return index === -1 ? -1 : index;
}

function headBlock({ host, site }) {
  const ogImage = `https://${host}/og.jpg`;
  const tags = [
    `<meta property="og:site_name" content="${escapeHtml(site)}">`,
    `<meta property="og:title" content="${escapeHtml(site)}">`,
    `<meta property="og:description" content="${escapeHtml(ogDescription(site))}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:image" content="${escapeHtml(ogImage)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<link rel="manifest" href="/__grok/manifest.webmanifest">`,
    `<meta name="theme-color" content="#101a2a">`,
  ];
  return `<!-- vantage-ars pwa/og -->${tags.join("")}<!-- /vantage-ars pwa/og -->`;
}

function ogDescription(site) {
  return `${site} — worldwide remote VoIP, networking and IT infrastructure support.`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Render the install-page template. Placeholders use mustache-style
 * `{{key}}` tokens so the template stays valid HTML on disk.
 */
export function renderInstallPageHtml(template, { host, url }) {
  return String(template)
    .replaceAll("{{HOST}}", escapeHtml(host))
    .replaceAll("{{URL}}", escapeHtml(url))
    .replaceAll("{{TITLE}}", "Install Vantage-ARS");
}

/** The per-app web manifest, named from the request host. */
export function renderWebManifest(host) {
  const manifest = {
    name: "Vantage-ARS",
    short_name: "Vantage-ARS",
    description:
      "Worldwide remote VoIP, networking and IT infrastructure support from Vantage-ARS.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f6fb",
    theme_color: "#101a2a",
    icons: [
      { src: "/__grok/icon-180.png", sizes: "180x180", type: "image/png" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
  return JSON.stringify(manifest, null, 2);
}
