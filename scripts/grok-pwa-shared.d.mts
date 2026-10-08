/** Type declarations for the dependency-free PWA/OG helpers. */
export function acceptsHtml(header: string | undefined | null): boolean;
export function isDocumentPath(pathname: string): boolean;
export function isInstallQuery(search: string | undefined | null): boolean;
export interface HeadInjector {
  push(chunk: Uint8Array): Uint8Array[];
  flush(): Uint8Array[];
}
export function createHeadInjector(options: {
  host: string;
  site: { title?: string; description?: string } | string;
}): HeadInjector;
export function renderInstallPageHtml(
  template: string,
  context: { host: string; url: string },
): string;
export function renderWebManifest(host: string): string;
