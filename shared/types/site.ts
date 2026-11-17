/** What the server routes (`server/api/`) answer and the pages render: plain data, serialised into the page's payload for the browser. */
import type { Region } from "../utils/regions";
import type { SORTS } from "../utils/range";
import type { Labels } from "../utils/texts";

/** A link to a page or product; `image` is the picture of a page teaser. */
export type Link = { url: string; title: string; image?: string };

/** The same content in every region that has it: region → URL. */
export type Alternates = Partial<Record<Region, string>>;

/** What every page of a region needs around its content: texts, navigation, the shop's public settings. */
export type SiteData = {
  region: Region;
  labels: Labels;
  home: Link;
  nav: (Link & { children: Link[] })[];
  /** Public Buy Button settings; empty without a shop. */
  shopify: { domain: string; token: string };
};

/** The sellable variant of a product: SKU, colour, stock and delivery time. */
export type Article = {
  id: number;
  productId: number;
  name: string;
  sku: string;
  /** A PIM object (`merchColor`) held by ID as a string: the value of its facet checkbox; name and swatch come with the labels. */
  color?: string;
  /** Pieces in stock; 0 is sold out. */
  stock: number;
  deliveryDays?: number;
};

/** What a product's SEO attributes ask of search engines. */
export type Seo = { title?: string; description?: string; noIndex: boolean; noFollow: boolean };

export type Product = {
  id: number;
  name: string;
  url: string;
  /** The URL without the region, e.g. `shop/t-shirts/we-build-value`. */
  path: string;
  /** The released articles; a product that has none is shown as available, but no filter counts it. */
  articles: Article[];
  /** Materials and finishes are PIM objects, held by ID as a string like an article's colour. */
  materials: string[];
  /** Cup volume in ml. */
  volume?: number;
  /** Sticker finishes, pieces per set, laptop sleeve screen size in inches. */
  finishes: string[];
  pieces?: number;
  screenSize?: number;
  /** Amount in the region's currency; undefined: no price in its market. */
  price?: number;
  /** `/media/{md5}/original{ext}` of the first picture. */
  image?: string;
  groupId?: number;
  descriptionHtml?: string;
  /** Object IDs of products: similar ones, accessories and spare parts, as an editor ordered them. */
  similar: number[];
  accessories: number[];
  spareParts: number[];
  /** The texts of the claims the product makes. */
  claims: string[];
  /** The rows of a set product: an article (by object ID) and how many of it. */
  setItems: { articleId: number; quantity: number }[];
  seo: Seo;
  shopifyId?: string;
};

export type Sort = (typeof SORTS)[number];

/** `shown`: how many cards of the result are rendered (a multiple of `RANGE_BATCH`); facets and count cover them all. */
export type Selection = { group: number[]; color: string[]; material: string[]; stock: boolean; min?: number; max?: number; sort?: Sort; shown: number };
export type FacetValue = { value: string; count: number; selected: boolean };
export type Facets = { group: FacetValue[]; color: FacetValue[]; material: FacetValue[]; inStock: number; priceMin: number; priceMax: number };

/** A live range: the first `selection.shown` products of the result (`items`), its size and the facets over all of it. */
export type RangeData = {
  items: Product[];
  total: number;
  facets: Facets;
  selection: Selection;
  /** "relevance" is offered only where it is the default: a search with usable terms. */
  defaultSort: Sort;
  groupNames: Record<number, string>;
};

/**
 * A Visual Document (page content), resolved on the server: links rewritten, embedded objects and pictures looked up.
 * `eager` marks the document's first picture, which is on screen at once (the hero): lazy loading would delay the largest contentful paint.
 */
export type ContentNode =
  | { kind: "group"; element: string; class?: string; children: ContentNode[] }
  | { kind: "html"; element: string; class?: string; html: string }
  | { kind: "image"; class?: string; src: string; eager?: true }
  | { kind: "product"; element: string; class?: string; product: Product }
  | { kind: "teaser"; element: string; class?: string; target: Link };
export type ContentRoot = { element: string; class?: string; children: ContentNode[] };

/** One row of a set product: how many of an article, linked to its product's page if that is on the site. */
export type SetRow = { quantity: number; name: string; url?: string };

type Common = { title: string; canonical: string; alternates: Alternates; crumbs: Link[] };
/** `/{region}/{path}`: a CMS page (content, maybe a live range) or a product. */
export type PageData =
  | (Common & { kind: "page"; content?: ContentRoot; range: RangeData | null })
  | (Common & {
    kind: "product";
    product: Product;
    groupName?: string;
    /** The rows of a set product, see `setContents`. */
    contents: SetRow[];
    similar: Product[];
    accessories: Product[];
    spareParts: Product[];
  });

/** `/{region}/search`: the query, matching pages and the products as a live range. */
export type SearchData = { q: string; pages: Link[]; range: RangeData };

/** `GET /api/suggest`: the typeahead's answer. */
export type Suggestions = { products: { name: string; url: string; image: string | null; price: string }[]; pages: Link[] };
