/** The page tree of the website: paths, navigation and the lookup of a URL. */
import { CULTURE, type Region } from "#shared/utils/regions";
import type { Link } from "#shared/types/site";
import { list, type Props } from "./delivery";
import { searchFilter } from "./products";
import { NAME, PAGE, PAGE_SEARCH_FIELDS, TYPE } from "./schema";

/** One node of a Visual Document as the Delivery API returns it. */
export type VNode = {
  type: "group" | "text" | "image" | "object" | "unknown";
  /** API identifier of the component's definition (`merchComponentRoot`, `merchComponentHero`, …); the site renders by `type`, `element` and `class`. */
  definition: string;
  element?: string;
  class?: string;
  content?: string;
  objectId?: number;
  children?: VNode[];
};

export type Page = {
  id: number;
  title: string;
  /** Short name for the navigation and the breadcrumb (`merchPageNavTitle`); the title where a page has none. */
  navTitle: string;
  /** URL of the page including the region, e.g. `/de/shop/tassen`. */
  url: string;
  path: string;
  segment: string;
  imageId?: number;
  parentId?: number;
  /** Product groups whose live range the page shows (category pages). */
  groupRefs: number[];
  content?: VNode;
  children: Page[];
};

export type Site = { home: Page; pages: Map<number, Page>; byPath: Map<string, Page> };

function toPage(id: number, p: Props): Page {
  return {
    id, path: "", url: "", children: [],
    segment: p[PAGE.urlSegment] ?? "",
    title: p[PAGE.title],
    navTitle: p[PAGE.navTitle] ?? p[PAGE.title],
    imageId: p[PAGE.image],
    parentId: p[PAGE.parent],
    groupRefs: p[PAGE.productGroups] ?? [],
    content: p[PAGE.content],
  };
}

/** Loads every page of the site in one language and links them into a tree. */
export async function loadSite(region: Region): Promise<Site> {
  const { objs } = await list(TYPE.page, { lang: CULTURE[region], sort: `${PAGE.sortKey} asc` });
  // A page without a title in this language is untranslated and left out; only the home page (no parent) has no URL segment.
  const shown = objs.filter((o) => o.props[PAGE.title] && (o.props[PAGE.urlSegment] || !o.props[PAGE.parent]));
  const pages = new Map(shown.map((o) => [o.meta.id, toPage(o.meta.id, o.props)]));
  const home = [...pages.values()].find((p) => !p.parentId);
  if (!home) throw new Error("No home page: no page without a parent page");

  const pathOf = (p: Page): string => {
    if (p === home || !p.parentId) return "";
    const parent = pages.get(p.parentId);
    return [parent ? pathOf(parent) : "", p.segment].filter(Boolean).join("/");
  };
  for (const page of pages.values()) {
    page.path = pathOf(page);
    page.url = `/${region}/${page.path}`;
    if (page.parentId) pages.get(page.parentId)?.children.push(page); // already sorted by sort key
  }
  const byPath = new Map([...pages.values()].map((p) => [p.path, p]));
  return { home, pages, byPath };
}

/** The first `take` pages that match what a visitor typed, best first. */
export async function searchPages(region: Region, q: string, take: number): Promise<Page[]> {
  const filter = searchFilter(q, PAGE_SEARCH_FIELDS);
  if (!filter) return [];
  const [{ objs: hits }, site] = await Promise.all([list(TYPE.page, { lang: CULTURE[region], take, sort: "$score", filter }), loadSite(region)]);
  return hits.flatMap((o) => site.pages.get(o.meta.id) ?? []);
}

/** Product groups (id → name) in one language. */
export async function loadGroups(region: Region): Promise<Record<number, string>> {
  const { objs } = await list(TYPE.group, { lang: CULTURE[region] });
  return Object.fromEntries(objs.filter((o) => o.props[NAME]).map((o) => [o.meta.id, o.props[NAME]]));
}

/** The page that presents a product group on its own (its category page), else the first page listing it. */
export function categoryPage(site: Site, groupId: number): Page | undefined {
  const pages = [...site.pages.values()].filter((p) => p.groupRefs.includes(groupId));
  return pages.find((p) => p.groupRefs.length === 1) ?? pages[0];
}

/** The trail from the home page down to the page, the page included, each named as in the navigation. */
export function breadcrumb(site: Site, page: Page | undefined): Link[] {
  const trail: Link[] = [];
  for (let p = page; p; p = p.parentId ? site.pages.get(p.parentId) : undefined) trail.unshift({ url: p.url, title: p.navTitle });
  return trail;
}
