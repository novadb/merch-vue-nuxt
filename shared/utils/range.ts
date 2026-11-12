/** Constants of a live range, the same on the server (`server/utils/products.ts`) and in the browser (`ProductRange.vue`). */

export const SORTS = ["relevance", "name", "price-asc", "price-desc"] as const;

/**
 * Cards a range shows at first and adds per "Show more": the grid has 1, 2 or 3 columns, so a multiple of 6 always
 * fills whole rows, and 12 cover the first screen and a half below the facets. The whole range is loaded all the same,
 * because the facets are counted over all of it: batches are a matter of rendering, not of Delivery paging.
 */
export const RANGE_BATCH = 12;
