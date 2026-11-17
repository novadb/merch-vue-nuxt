/** GET /api/search?region=&q=: full-text search over products (as a live range, for the range form's fields in the same query) and pages. */
import type { SearchData } from "#shared/types/site";
import { isRegion } from "#shared/utils/regions";
import { loadProducts, rangeOf, searchFilter } from "../utils/products";
import { PRODUCT_SEARCH_FIELDS } from "../utils/schema";
import { loadGroups, searchPages } from "../utils/site";

export default defineEventHandler(async (event): Promise<SearchData> => {
  const query = getRequestURL(event).searchParams;
  const region = query.get("region");
  if (!isRegion(region)) throw createError({ statusCode: 404 });
  const q = (query.get("q") ?? "").trim();
  const productFilter = searchFilter(q, PRODUCT_SEARCH_FIELDS);
  const [products, pages, groupNames] = await Promise.all([
    loadProducts(region, productFilter, productFilter ? "$score" : undefined),
    searchPages(region, q, 5),
    loadGroups(region),
  ]);
  return {
    q,
    pages: pages.map((p) => ({ url: p.url, title: p.title })),
    range: rangeOf(products, query, productFilter ? "relevance" : "name", groupNames),
  };
});
