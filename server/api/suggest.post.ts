/** POST /api/suggest with the form fields `lang` and `q` → { products: [...5], pages: [...3] } for the header's typeahead. */
import type { Suggestions } from "#shared/types/site";
import { formatPrice, isRegion } from "#shared/utils/regions";
import { smallSrc } from "#shared/utils/pictures";
import { readForm } from "../utils/form";
import { loadProducts, searchFilter } from "../utils/products";
import { PRODUCT_SEARCH_FIELDS } from "../utils/schema";
import { searchPages } from "../utils/site";

export default defineEventHandler(async (event): Promise<Suggestions> => {
  const form = await readForm(event);
  const region = form.get("lang");
  if (!isRegion(region)) throw createError({ statusCode: 404 });
  const q = (form.get("q") ?? "").trim();
  const productFilter = q.length >= 2 ? searchFilter(q, PRODUCT_SEARCH_FIELDS) : undefined;
  if (!productFilter) return { products: [], pages: [] };

  const [products, pages] = await Promise.all([loadProducts(region, productFilter, "$score"), searchPages(region, q, 3)]);
  return {
    products: products.slice(0, 5).map((p) => ({ name: p.name, url: p.url, image: p.image ? smallSrc(p.image) : null, price: formatPrice(p.price, region) })),
    pages: pages.map((p) => ({ title: p.title, url: p.url })),
  };
});
