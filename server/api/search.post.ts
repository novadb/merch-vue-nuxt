/** POST /api/search with `{ region, form }`: full-text search over products (as a live range) and pages; the query is the form's field `q`. */
import type { SearchData } from "#shared/types/site";
import { isRegion } from "#shared/utils/regions";
import { loadProducts, rangeOf, searchFilter } from "../utils/products";
import { PRODUCT_SEARCH_FIELDS } from "../utils/schema";
import { loadGroups, searchPages } from "../utils/site";

export default defineEventHandler(async (event): Promise<SearchData> => {
  const { region, form: posted } = await readBody<{ region: string; form: string }>(event);
  if (!isRegion(region)) throw createError({ statusCode: 404 });
  const form = new URLSearchParams(posted);
  const q = (form.get("q") ?? "").trim();
  const productFilter = searchFilter(q, PRODUCT_SEARCH_FIELDS);
  const [products, pages, groupNames] = await Promise.all([
    loadProducts(region, productFilter, productFilter ? "$score" : undefined),
    searchPages(region, q, 5),
    loadGroups(region),
  ]);
  return {
    q,
    pages: pages.map((p) => ({ url: p.url, title: p.title })),
    range: rangeOf(products, form, productFilter ? "relevance" : "name", groupNames),
  };
});
