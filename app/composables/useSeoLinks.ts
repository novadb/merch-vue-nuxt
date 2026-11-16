/** Canonical URL and language/region variants (`rel="canonical"`, `rel="alternate" hreflang`) for search engines. */
import type { Alternates, Seo } from "#shared/types/site";
import { HTML_LANG, REGIONS } from "#shared/utils/regions";

/**
 * Public origin (`https://host`) for absolute URLs: `SITE_URL` if set, else what the ingress forwards
 * (`X-Forwarded-Proto/Host`), else the request's own. A client can forge those headers: set `SITE_URL` in production.
 * Worked out on the server; the browser takes it from the payload.
 */
function useOrigin() {
  return useState("origin", () => {
    const configured = import.meta.server ? process.env.SITE_URL : undefined;
    if (configured) return configured.replace(/\/+$/, "");
    const headers = useRequestHeaders(["host", "x-forwarded-host", "x-forwarded-proto"]);
    const first = (value?: string) => value?.split(",")[0]?.trim();
    const own = useRequestURL();
    return `${first(headers["x-forwarded-proto"]) ?? own.protocol.replace(":", "")}://${first(headers["x-forwarded-host"]) ?? headers.host ?? own.host}`;
  });
}

/**
 * `path` is the page's clean URL (no filters, sorting, tracking parameters). `variants` holds the same content in every
 * region that has it, the page itself included: every variant lists all of them, `x-default` is `/`, which picks a region.
 * A page that asks not to be indexed lists no variants: it is not part of the language set.
 */
export function useSeoLinks(path: string, variants: Alternates, hints: Partial<Seo> = {}) {
  const origin = useOrigin().value;
  const alternates = hints.noIndex ? [] : REGIONS.flatMap((region) => (variants[region] ? [{ hreflang: HTML_LANG[region], href: origin + variants[region] }] : []));
  if (alternates.length) alternates.push({ hreflang: "x-default", href: `${origin}/` });
  const robots = [hints.noIndex && "noindex", hints.noFollow && "nofollow"].filter(Boolean).join(", ");
  useHead({
    link: [{ rel: "canonical", href: origin + path }, ...alternates.map((a) => ({ rel: "alternate" as const, ...a }))],
    meta: [
      ...(hints.description ? [{ name: "description", content: hints.description }] : []),
      ...(robots ? [{ name: "robots", content: robots }] : []),
    ],
  });
}
