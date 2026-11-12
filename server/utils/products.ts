/** Products from the PIM: loading, search, facets and sorting. */
import { CULTURE, MARKET, type Region } from "#shared/utils/regions";
import { RANGE_BATCH, SORTS } from "#shared/utils/range";
import type { Facets, FacetValue, Product, RangeData, Selection, Sort } from "#shared/types/site";
import { list, type NovaObject } from "./delivery";
import { toImages } from "./images";
import { MARKET_VARIANT, PRODUCT, TYPE } from "./schema";

/** Removes the XHTML namespace the CMS stores with rich text. */
export const cleanHtml = (html: string) => html.replace(/\sxmlns="[^"]*"/g, "");

function toProduct(o: NovaObject, region: Region, images: Map<number, string>): Product {
  const p = o.props;
  return {
    id: o.meta.id,
    name: p[PRODUCT.name],
    path: p[PRODUCT.urlSegment],
    url: `/${region}/${p[PRODUCT.urlSegment]}`,
    sku: p[PRODUCT.sku],
    color: p[PRODUCT.color] ? String(p[PRODUCT.color]) : undefined,
    materials: (p[PRODUCT.materials] ?? []).map(String),
    volume: p[PRODUCT.cupVolume],
    finishes: (p[PRODUCT.finish] ?? []).map(String),
    pieces: p[PRODUCT.pieces],
    screenSize: p[PRODUCT.screenSize],
    price: p[PRODUCT.price],
    inStock: p[PRODUCT.inStock],
    image: images.get(p[PRODUCT.images]?.[0]),
    groupId: p[PRODUCT.group],
    descriptionHtml: p[PRODUCT.description]?.XML ? cleanHtml(p[PRODUCT.description].XML) : undefined,
    similar: p[PRODUCT.similar] ?? [],
    shopifyId: p[PRODUCT.shopifyId],
  };
}

/**
 * Every product matching a Delivery filter, or the first `take` of them (one request), priced in the region's market; the
 * pictures arrive in the same response (`resolve`). Products without a name or URL segment are dropped after the read.
 */
export async function loadProducts(region: Region, filter?: string, sort?: string, take?: number): Promise<Product[]> {
  const { objs, refs } = await list(TYPE.product, { lang: CULTURE[region], variants: MARKET_VARIANT[MARKET[region]], filter, sort, take, resolve: PRODUCT.images });
  const images = toImages(refs);
  return objs.filter((o) => o.props[PRODUCT.name] && o.props[PRODUCT.urlSegment]).map((o) => toProduct(o, region, images));
}

/** Products by ID, in the order of `ids` (the order an editor chose). */
export async function productsByIds(ids: number[], region: Region): Promise<Product[]> {
  if (!ids.length) return [];
  const byId = new Map((await loadProducts(region, `meta.id = ${ids.join(", ")}`)).map((p) => [p.id, p]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export async function productByPath(region: Region, path: string): Promise<Product | undefined> {
  const [product] = await loadProducts(region, `${PRODUCT.urlSegment} = "${path.replace(/["\\]/g, "")}"`);
  return product;
}

/** Lucene-safe prefix terms (`+term*`) from the first 100 characters a visitor typed; empty when nothing usable is left. */
function searchTerms(query: string): string[] {
  return query
    .slice(0, 100)
    .toLowerCase()
    .replace(/[+\-!(){}[\]^"~*?:\\/&|]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 0)
    .slice(0, 6)
    .map((term) => `+${term}*`);
}

/** Full-text filter over the given text fields: every term must match within one field. */
export function searchFilter(query: string, fields: string[]): string | undefined {
  const terms = searchTerms(query).join(" ");
  return terms ? "(" + fields.map((f) => `${f}: ${terms}`).join(" || ") + ")" : undefined;
}

// ---- facets -------------------------------------------------------------------------------------

/**
 * The filters and sorting of a posted range form; the form's "reset" button clears them all. Only the "Show more"
 * button posts `shown`, so any other change starts again with the first batch.
 */
export function parseSelection(posted: URLSearchParams): Selection {
  const params = posted.has("reset") ? new URLSearchParams() : posted;
  const num = (key: string) => {
    const value = Number(params.get(key));
    return params.get(key) && Number.isFinite(value) ? value : undefined;
  };
  const sort = params.get("sort") as Sort;
  return {
    group: params.getAll("group").map(Number).filter(Number.isInteger),
    color: params.getAll("color"),
    material: params.getAll("material"),
    stock: params.get("stock") === "1",
    min: num("min"),
    max: num("max"),
    sort: SORTS.includes(sort) ? sort : undefined,
    shown: Math.max(1, Math.ceil((num("shown") ?? 0) / RANGE_BATCH)) * RANGE_BATCH,
  };
}

/** The facets with a list of values; a new one needs its values here, or the lookup does not compile. */
type ListFacet = "group" | "color" | "material";
type Facet = ListFacet | "stock" | "price";
const facetValues = (p: Product, facet: ListFacet): string[] =>
  ({ group: p.groupId ? [String(p.groupId)] : [], color: p.color ? [p.color] : [], material: p.materials })[facet];

/** Whether a product passes every selected facet except `skip` (so a facet's own counts stay open). */
function passes(p: Product, s: Selection, skip?: Facet): boolean {
  const any = (facet: ListFacet, selected: string[]) =>
    skip === facet || !selected.length || facetValues(p, facet).some((v) => selected.includes(v));
  return (
    any("group", s.group.map(String)) && any("color", s.color) && any("material", s.material) &&
    (skip === "stock" || !s.stock || p.inStock === true) &&
    (skip === "price" || ((s.min === undefined || (p.price ?? 0) >= s.min) && (s.max === undefined || (p.price ?? Infinity) <= s.max)))
  );
}

/**
 * A facet's values. The list is stable: every value of the unfiltered range, most products first, whatever is selected,
 * so a filter change moves no row. `count` is what the other facets leave of it and may be 0.
 */
function count(products: Product[], s: Selection, facet: ListFacet, selected: string[]): FacetValue[] {
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const p of products) {
    for (const v of facetValues(p, facet)) {
      totals.set(v, (totals.get(v) ?? 0) + 1);
      if (passes(p, s, facet)) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  for (const v of selected) if (!totals.has(v)) totals.set(v, 0);
  return [...totals]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value]) => ({ value, count: counts.get(value) ?? 0, selected: selected.includes(value) }));
}

/**
 * The live range of `products` for a posted form: the selection applied, each facet counted over the products the other
 * facets let through, sorted, and cut to the cards that are shown (the browser gets no more than it renders).
 */
export function rangeOf(products: Product[], posted: URLSearchParams, defaultSort: Sort, groupNames: Record<number, string>): RangeData {
  const s = parseSelection(posted);
  const prices = products.map((p) => p.price).filter((v): v is number => v !== undefined);
  const facets: Facets = {
    group: count(products, s, "group", s.group.map(String)),
    color: count(products, s, "color", s.color),
    material: count(products, s, "material", s.material),
    inStock: products.filter((p) => p.inStock && passes(p, s, "stock")).length,
    priceMin: prices.length ? Math.floor(Math.min(...prices)) : 0,
    priceMax: prices.length ? Math.ceil(Math.max(...prices)) : 0,
  };
  const items = products.filter((p) => passes(p, s));
  const sort = s.sort ?? defaultSort;
  const byPrice = (a: Product, b: Product) => (a.price ?? Infinity) - (b.price ?? Infinity);
  if (sort === "name") items.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "price-asc") items.sort(byPrice);
  if (sort === "price-desc") items.sort((a, b) => byPrice(b, a));
  // "relevance" keeps the order the products came in
  return { items: items.slice(0, s.shown), total: items.length, facets, selection: s, defaultSort, groupNames };
}
