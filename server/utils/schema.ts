/**
 * Every NovaDB name the site depends on, in one place. IDs of branches and object types differ from installation to
 * installation, API identifiers do not, so the code addresses everything by identifier. The site's own identifiers carry
 * the prefix `merch` because they must be unique across branches; NovaDB's own (`image`, `typeAttribute`,
 * `attributeName`, the file attributes) do not.
 *
 * The Delivery API serves an identifier with a lower-case first letter, which is why the keys below start in lower case.
 * A numeric ID belongs here too, as a named constant with a comment, where one is unavoidable (`WORKFLOW_RELEASED`).
 */

/** API identifier of the branch (default of `DEMO_BRANCH`; a numeric branch ID works as well). */
export const BRANCH = "merchDemo";

/** Object types, as used in `types/{type}/objects`. */
export const TYPE = {
  page: "merchPage",
  product: "merchProduct",
  /** A product's sellable variant (SKU, colour, stock, delivery time). */
  article: "merchArticle",
  group: "merchProductGroup",
  image: "image",
  label: "merchLabel",
  color: "merchColor",
  material: "merchMaterial",
  finish: "merchFinish",
  claim: "merchClaim",
  /** The rows of a set product, an anonymous type: only reachable through `PRODUCT.setItems`. */
  setItem: "merchSetItem",
  /** NovaDB's own type of attribute definitions: the site prints a product attribute under its name from here. */
  attribute: "typeAttribute",
} as const;

/** Attributes of a label: one UI text, its key language-neutral, its text per language. */
export const LABEL = {
  key: "merchLabelKey",
  text: "merchLabelText",
} as const;

/** Attributes of a page. `parent` is the Sitemap relation to the page above. */
export const PAGE = {
  title: "merchPageTitle",
  navTitle: "merchPageNavTitle",
  urlSegment: "merchPageUrlSegment",
  sortKey: "merchPageSortKey",
  image: "merchPageImage",
  content: "merchPageContent",
  productGroups: "merchPageProductGroups",
  parent: "merchPageParent",
} as const;

/**
 * Attributes of a product. Only what the type releases to the Delivery API arrives in `props`: an unreleased attribute reads as unset, without an error.
 * A product is what the site shows (page, card, price, Shopify ID); its articles carry SKU, colour and stock.
 */
export const PRODUCT = {
  name: "merchProductName",
  description: "merchProductDescription",
  number: "merchProductNumber",
  /** Reference to the product group (the parent in the group tree). */
  group: "merchProductParent",
  /** One price per market (`MARKET_VARIANT`). */
  price: "merchProductSalesPrice",
  images: "merchProductImages",
  related: "merchProductRelated",
  accessories: "merchProductAccessories",
  spareParts: "merchProductSpareParts",
  /** Unlike a page's, the whole path without the region (`shop/t-shirts/we-build-value`), not one segment. */
  urlSegment: "merchProductUrlSegment",
  shopifyId: "merchProductShopifyId",
  /** References to `merchClaim` objects: statements the product may make. */
  claims: "merchProductClaims",
  /** References to `merchSetItem` objects, set only on a set product. */
  setItems: "merchProductSetItems",
  /** References to `merchMaterial`, `merchFinish` objects. */
  materials: "merchProductMaterials",
  finishes: "merchProductFinishes",
  /** Volume in cm³ (a cup's, printed as ml), pieces per set, screen size in inches. */
  volume: "merchProductVolume",
  pieces: "merchProductPiecesPerSet",
  screenSize: "merchProductScreenSize",
  seoTitle: "merchSeoTitle",
  seoDescription: "merchSeoDescription",
  seoNoIndex: "merchSeoNoIndex",
  seoNoFollow: "merchSeoNoFollow",
  /** Reference to a workflow state (see `WORKFLOW_RELEASED`). */
  workflow: "merchProductWorkflow",
} as const;

/** Attributes of an article, the sellable variant of a product. */
export const ARTICLE = {
  /** The SKU. */
  number: "merchArticleNumber",
  name: "merchArticleName",
  product: "merchArticleParent",
  /** Reference to a `merchColor` object. */
  color: "merchArticleColor",
  /** Pieces in stock; 0 is sold out. */
  stock: "merchArticleStock",
  deliveryDays: "merchArticleDeliveryDays",
  workflow: "merchArticleWorkflow",
} as const;

export const CLAIM = { text: "merchClaimText" } as const;
export const SET_ITEM = { article: "merchSetItemArticle", quantity: "merchSetItemQuantity" } as const;

/**
 * The workflow state "released": only products and articles in it are on the site, the rest is still being edited or
 * checked. A reference attribute is filtered by the target's object ID, and the state objects have no API identifier.
 * The ID is the same in every branch of this installation.
 */
export const WORKFLOW_RELEASED = 2108321;

/**
 * Attributes of an image (a file type: the object IS the file). MD5 and extension give the content address
 * `files/{md5}{extension}`. The type must release both to the Delivery API.
 */
export const IMAGE = {
  md5: "externalBinaryMD5",
  extension: "externalBinaryFileExtension",
} as const;

/**
 * Name of a product group, a colour, a material, a finish and of an attribute definition: NovaDB's system attribute
 * `AttributeName` (small ID, the same everywhere), per language.
 */
export const NAME = "attributeName";

/** The swatch of a colour: a CSS hex value. */
export const COLOR_HEX = "merchColorHex";

/** Market → the variant of the price axis, the value of the Delivery API's `variants` parameter. */
export const MARKET_VARIANT = {
  EU: "merchMarketEU",
  US: "merchMarketUS",
  UK: "merchMarketUK",
} as const;

/** Fields the full-text search looks in. */
export const PRODUCT_SEARCH_FIELDS = [PRODUCT.name, PRODUCT.number, PRODUCT.description];
export const PAGE_SEARCH_FIELDS = [PAGE.title, PAGE.content];
