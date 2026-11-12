/**
 * Every NovaDB name the site depends on, in one place. IDs of branches and object types differ from installation to
 * installation, API identifiers do not, so the code addresses everything by identifier. The identifiers carry the
 * prefix `merch` because they must be unique across branches.
 *
 * The Delivery API serves an identifier with a lower-case first letter, which is why the keys below start in lower case.
 * A numeric ID belongs here too (as a named constant with a comment) if one is ever unavoidable; today there is none.
 */

/** API identifier of the branch (default of `DEMO_BRANCH`; a numeric branch ID works as well). */
export const BRANCH = "merchDemo";

/** Object types, as used in `types/{type}/objects`. */
export const TYPE = {
  page: "merchPage",
  product: "merchProduct",
  group: "merchProductGroup",
  image: "image",
  label: "merchLabel",
  color: "merchColor",
  material: "merchMaterial",
  finish: "merchFinish",
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

/** Attributes of a product. */
export const PRODUCT = {
  name: "merchProductName",
  description: "merchProductDescription",
  sku: "merchProductSku",
  group: "merchProductGroupRef",
  price: "merchProductPrice",
  inStock: "merchProductInStock",
  images: "merchProductImages",
  similar: "merchProductSimilar",
  urlSegment: "merchProductUrlSegment",
  shopifyId: "merchProductShopifyId",
  /** References to `merchColor`, `merchMaterial`, `merchFinish` objects. */
  color: "merchProductColorRef",
  materials: "merchProductMaterialRefs",
  cupVolume: "merchProductCupVolume",
  finish: "merchProductFinishRefs",
  pieces: "merchProductPieces",
  screenSize: "merchProductScreenSize",
} as const;

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
export const PRODUCT_SEARCH_FIELDS = [PRODUCT.name, PRODUCT.sku, PRODUCT.description];
export const PAGE_SEARCH_FIELDS = [PAGE.title, PAGE.content];
