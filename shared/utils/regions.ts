/**
 * A region is the first URL segment (`/de/…`, `/uk/…`, `/us/…`). It fixes the content language, the UI texts, the market
 * and the currency: `de` is German in euros, `uk` English in pounds, `us` English in dollars. Used on the server and in the browser.
 */
export const REGIONS = ["de", "uk", "us"] as const;
export type Region = (typeof REGIONS)[number];
export const isRegion = (value: unknown): value is Region => REGIONS.includes(value as Region);

/** NovaDB content language per region: `uk` and `us` share the English content. */
export const CULTURE: Record<Region, string> = { de: "de-DE", uk: "en-US", us: "en-US" };
/** Language tag for `<html lang>`, `hreflang` and number formatting. */
export const HTML_LANG: Record<Region, string> = { de: "de", uk: "en-GB", us: "en-US" };
/** The region of the other content language: where the German and English version of an object are looked up. */
export const OTHER_LANGUAGE_REGION: Record<Region, Region> = { de: "uk", uk: "de", us: "de" };
/** Short label and tooltip of a region in the header switch. */
export const REGION_LABEL: Record<Region, { short: string; title: string }> = {
  de: { short: "DE", title: "Deutschland · Euro" },
  uk: { short: "UK", title: "United Kingdom · Pound" },
  us: { short: "US", title: "United States · Dollar" },
};

export type Market = "EU" | "UK" | "US";
/** The price market of a region. */
export const MARKET: Record<Region, Market> = { de: "EU", uk: "UK", us: "US" };
const CURRENCY: Record<Market, string> = { EU: "EUR", US: "USD", UK: "GBP" };

/** A price in the region's currency and number format; empty where the product has no price in its market. */
export function formatPrice(value: number | undefined, region: Region): string {
  if (value === undefined) return "";
  return new Intl.NumberFormat(HTML_LANG[region], { style: "currency", currency: CURRENCY[MARKET[region]] }).format(value);
}

/** The region of a URL path; the error page of a path without one (`/en/…`) speaks US English, like the start page's fallback. */
export function regionOfPath(path: string): Region {
  const first = path.split("/")[1];
  return isRegion(first) ? first : "us";
}
