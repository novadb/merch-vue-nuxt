/**
 * GET /api/page?region=&path=: the data of `/{region}/{path}`, a CMS page (content and its live range for the range
 * form's fields, which the page's own query string passes on) or a product from the PIM. 404 for any other path.
 */
import type { Alternates, Link, PageData, Product } from "#shared/types/site";
import { CULTURE, isRegion, OTHER_LANGUAGE_REGION, REGIONS, type Region } from "#shared/utils/regions";
import { imageIds, referencedIds, resolveDocument } from "../utils/content";
import { imagesByIds } from "../utils/images";
import { loadProducts, productByPath, productsByIds, rangeOf, setContents } from "../utils/products";
import { PRODUCT } from "../utils/schema";
import { breadcrumb, categoryPage, loadGroups, loadSite, type Page, type Site } from "../utils/site";

export default defineEventHandler(async (event): Promise<PageData> => {
  const query = getRequestURL(event).searchParams;
  const region = query.get("region");
  const path = query.get("path") ?? "";
  if (!isRegion(region)) throw createError({ statusCode: 404 });
  const site = await loadSite(region);
  const page = site.byPath.get(path);
  return page ? pageData(site, page, region, query) : productData(site, region, path);
});

/** The same content in every region: `own` is the path (without region) in the content language of `region`, `other` in the other one. */
function alternatesOf(region: Region, own: string | undefined, other: string | undefined): Alternates {
  const result: Alternates = {};
  for (const r of REGIONS) {
    const path = CULTURE[r] === CULTURE[region] ? own : other;
    if (path !== undefined) result[r] = `/${r}/${path}`;
  }
  return result;
}

async function pageData(site: Site, page: Page, region: Region, query: URLSearchParams): Promise<PageData> {
  const embeddedIds = [...referencedIds(page.content)].filter((ref) => !site.pages.has(ref));
  const wantedImages = imageIds(page.content); // plus the teaser picture of every page
  for (const p of site.pages.values()) if (p.imageId) wantedImages.add(p.imageId);
  const [embedded, range, images, groupNames, otherSite] = await Promise.all([
    productsByIds(embeddedIds, region),
    page.groupRefs.length ? loadProducts(region, `${PRODUCT.group} = ${page.groupRefs.join(", ")}`) : [],
    imagesByIds([...wantedImages]),
    loadGroups(region),
    loadSite(OTHER_LANGUAGE_REGION[region]), // for the hreflang alternates
  ]);
  const targets = new Map<number, Link>();
  for (const p of site.pages.values()) targets.set(p.id, { url: p.url, title: p.title, image: p.imageId ? images.get(p.imageId) : undefined });
  for (const p of embedded) targets.set(p.id, { url: p.url, title: p.name, image: p.image });
  return {
    kind: "page",
    title: page.title,
    canonical: page.url,
    alternates: alternatesOf(region, page.path, otherSite.pages.get(page.id)?.path),
    crumbs: breadcrumb(site, page),
    content: page.content && resolveDocument(page.content, { targets, products: new Map(embedded.map((p) => [p.id, p])), images }),
    range: range.length ? rangeOf(range, query, "name", groupNames) : null,
  };
}

async function productData(site: Site, region: Region, path: string): Promise<PageData> {
  const product: Product | undefined = path ? await productByPath(region, path) : undefined;
  if (!product) throw createError({ statusCode: 404 });
  const [similar, accessories, spareParts, contents, [other], groups] = await Promise.all([
    productsByIds(product.similar, region),
    productsByIds(product.accessories, region),
    productsByIds(product.spareParts, region),
    setContents(product, region),
    productsByIds([product.id], OTHER_LANGUAGE_REGION[region]),
    loadGroups(region),
  ]);
  const category = product.groupId ? categoryPage(site, product.groupId) : undefined;
  return {
    kind: "product",
    title: product.seo.title ?? product.name,
    canonical: product.url,
    alternates: alternatesOf(region, product.path, other?.path),
    crumbs: [...breadcrumb(site, category), { url: product.url, title: product.name }],
    product,
    groupName: product.groupId ? groups[product.groupId] : undefined,
    contents,
    similar,
    accessories,
    spareParts,
  };
}
