/** GET /api/site/{region}: what every page of a region renders around its content: texts, navigation, the shop's public settings. */
import type { SiteData } from "#shared/types/site";
import { isRegion } from "#shared/utils/regions";
import { loadLabels } from "../../utils/labels";
import { loadSite } from "../../utils/site";

export default defineEventHandler(async (event): Promise<SiteData> => {
  const region = getRouterParam(event, "region");
  if (!isRegion(region)) throw createError({ statusCode: 404 });
  const [site, labels] = await Promise.all([loadSite(region), loadLabels(region)]);
  return {
    region,
    labels,
    home: { url: site.home.url, title: site.home.title },
    nav: site.home.children.map((p) => ({ url: p.url, title: p.navTitle, children: p.children.map((c) => ({ url: c.url, title: c.navTitle })) })),
    // Public values (the Buy Button's storefront token is meant for the browser); without both there is no shop.
    shopify: { domain: process.env.SHOPIFY_DOMAIN ?? "", token: process.env.SHOPIFY_STOREFRONT_TOKEN ?? "" },
  };
});
