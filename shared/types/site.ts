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

export type Product = {
  id: number;
  name: string;
  url: string;
  /** The URL without the region, e.g. `shop/t-shirts/we-build-value`. */
  path: string;
  sku?: string;
  /** Colour, materials and finishes are PIM objects, held by ID as a string: the value of their facet checkbox; names and swatches come with the labels. */
  color?: string;
  materials: string[];
  /** Cup volume in ml. */
  volume?: number;
  /** Sticker finishes, pieces per set, laptop sleeve screen size in inches. */
  finishes: string[];
  pieces?: number;
  screenSize?: number;
  /** Amount in the region's currency; undefined: no price in its market. */
  price?: number;
  /** `false` is sold out; not set: shown as available, but not counted by the in-stock filter. */
  inStock?: boolean;
  /** `/media/{md5}/original{ext}` of the first picture. */
  image?: string;
  groupId?: number;
  descriptionHtml?: string;
  similar: number[];
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

/** A Visual Document (page content), resolved on the server: links rewritten, embedded objects and pictures looked up. */
export type ContentNode =
  | { kind: "group"; element: string; class?: string; children: ContentNode[] }
  | { kind: "html"; element: string; class?: string; html: string }
  | { kind: "image"; class?: string; src: string }
  | { kind: "product"; element: string; class?: string; product: Product }
  | { kind: "teaser"; element: string; class?: string; target: Link };
export type ContentRoot = { element: string; class?: string; children: ContentNode[] };

type Common = { title: string; canonical: string; alternates: Alternates; crumbs: Link[] };
/** `/{region}/{path}`: a CMS page (content, maybe a live range) or a product. */
export type PageData =
  | (Common & { kind: "page"; content?: ContentRoot; range: RangeData | null })
  | (Common & { kind: "product"; product: Product; groupName?: string; similar: Product[] });

/** `/{region}/search`: the query, matching pages and the products as a live range. */
export type SearchData = { q: string; pages: Link[]; range: RangeData };

/** `POST /api/suggest`: the typeahead's answer. */
export type Suggestions = { products: { name: string; url: string; image: string | null; price: string }[]; pages: Link[] };
