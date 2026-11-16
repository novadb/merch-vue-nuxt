/** What a product's articles say about it: the product itself has no colour and no stock. */
import type { Product } from "../types/site";

/** The colours of a product's articles, without repeats. */
export const colorsOf = (p: Product): string[] => [...new Set(p.articles.flatMap((a) => a.color ?? []))];

/** `false` is sold out (no article in stock); `undefined`: no article, shown as available, but not counted by the in-stock filter. */
export const inStockOf = (p: Product): boolean | undefined => (p.articles.length ? p.articles.some((a) => a.stock > 0) : undefined);
