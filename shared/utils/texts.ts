/** The UI texts the site prints itself. They are NovaDB data (labels, read by `server/utils/labels.ts`); this turns them into texts. */
import { CULTURE, HTML_LANG, type Region } from "./regions";

/**
 * Everything the site prints that is not content, in one language:
 * - `texts`: UI texts by key (`merchLabel` objects; `{n}` and `{q}` are placeholders; a count has one label per plural
 *   form, `results.one`, `results.other`), and the names of the product attributes (`ATTRIBUTE`).
 * - `values`: colours, materials and finishes, PIM objects a product references, by object ID: name and, for a colour, its swatch.
 */
export type PimValue = { name?: string; hex?: string };
export type Labels = { texts: Record<string, string>; values: Record<string, PimValue> };

/** UI text keys that are the names of product attributes: the name of the attribute's definition in NovaDB (`server/utils/labels.ts`). */
const ATTRIBUTE = ["group", "sku", "colour", "material", "price", "availability", "volume", "finish", "pieces", "screenSize"] as const;

/** Plain texts: printed escaped. */
const PLAIN = [
  "siteName", "skip", "mainNav", "breadcrumb", "region", "home", "notFound",
  "search", "searchPlaceholder", "pagesFound", "products", "searchAll",
  "filter", "apply", "reset", "sort", "sortRelevance", "sortName", "sortPriceAsc", "sortPriceDesc",
  "inStock", "from", "to", "noResults", "showMore", "available", "soldOut", "similar",
  "addToCart", "cart", "subtotal", "checkout", "cartEmpty", "cartNotice",
] as const;
/** Texts that may carry inline HTML (links, emphasis): wrapped, so that only `v-html="text.x.html"` uses them. */
const HTML = ["poweredBy", "notFoundText"] as const;

export type Texts = Record<(typeof PLAIN)[number], string> & Record<(typeof HTML)[number], { html: string }> &
  Record<(typeof ATTRIBUTE)[number], string> & {
  results: (n: number) => string;
  pieceCount: (n: number) => string;
  searchTitle: (q: string) => string;
  /** The name of a PIM value (colour, material, finish object, by ID) in this language. */
  value: (id: string) => string;
  /** The swatch of a colour (by ID), a CSS colour; undefined if the colour has none. */
  swatch: (id: string) => string | undefined;
};

const reported = new Set<string>();
/** A text the language lacks shows as `⟦key⟧`, never as another language's text, and is logged once. */
function missing(key: string, region: Region, where: string): string {
  if (!reported.has(`${region}:${key}`)) console.error(`'${key}' has no text in ${CULTURE[region]} (${where})`);
  reported.add(`${region}:${key}`);
  return `⟦${key}⟧`;
}

/** The texts of a region, built from its labels. */
export function t(labels: Labels, region: Region): Texts {
  const get = (key: string) => labels.texts[key] ?? missing(key, region, "merchLabel");
  const plural = new Intl.PluralRules(HTML_LANG[region]);
  const count = (key: string) => (n: number) => get(`${key}.${plural.select(n)}`).replace("{n}", String(n));
  return {
    ...(Object.fromEntries(PLAIN.map((key) => [key, get(key)])) as Record<(typeof PLAIN)[number], string>),
    ...(Object.fromEntries(HTML.map((key) => [key, { html: get(key) }])) as Record<(typeof HTML)[number], { html: string }>),
    ...(Object.fromEntries(ATTRIBUTE.map((key) => [key, labels.texts[key] ?? missing(key, region, "attribute name")])) as Record<(typeof ATTRIBUTE)[number], string>),
    results: count("results"),
    pieceCount: count("pieceCount"),
    searchTitle: (q) => (q ? get("searchTitle").replace("{q}", q) : get("searchTitle.empty")),
    value: (id) => labels.values[id]?.name ?? missing(`value ${id}`, region, "name of a colour, material or finish"),
    swatch: (id) => labels.values[id]?.hex,
  };
}
