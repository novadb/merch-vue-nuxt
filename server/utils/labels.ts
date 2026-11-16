/** The UI texts and PIM value names of a region's content language, read from NovaDB like the content (`shared/utils/texts.ts` prints them). */
import type { Labels } from "#shared/utils/texts";
import { CULTURE, type Region } from "#shared/utils/regions";
import { list } from "./delivery";
import { ARTICLE, COLOR_HEX, LABEL, NAME, PRODUCT, TYPE } from "./schema";

/** UI text key → the product attribute whose name it is: the name an editor sees in the CMS is the name on the site. */
const ATTRIBUTE_TEXT = {
  group: PRODUCT.group, sku: ARTICLE.number, colour: ARTICLE.color, material: PRODUCT.materials, price: PRODUCT.price,
  availability: ARTICLE.stock, volume: PRODUCT.volume, finish: PRODUCT.finishes, pieces: PRODUCT.pieces,
  screenSize: PRODUCT.screenSize, delivery: ARTICLE.deliveryDays,
} as const;

/**
 * Labels (`merchLabel`: one object per key, the text per language), the names of the product attributes (their
 * definitions, NovaDB's `typeAttribute`) and the colours, materials and finishes: five requests, cached like every Delivery read.
 */
export async function loadLabels(region: Region): Promise<Labels> {
  const culture = CULTURE[region];
  const filter = `meta.apiIdentifier = ${Object.values(ATTRIBUTE_TEXT).join(", ")}`;
  const [labels, attributes, ...values] = await Promise.all([
    list(TYPE.label, { lang: culture }),
    list(TYPE.attribute, { lang: culture, props: 1, filter }),
    ...[TYPE.color, TYPE.material, TYPE.finish].map((type) => list(type, { lang: culture })),
  ]);
  const texts: Record<string, string> = {};
  for (const o of labels.objs) if (o.props[LABEL.text] !== undefined) texts[o.props[LABEL.key]] = o.props[LABEL.text];
  for (const [key, identifier] of Object.entries(ATTRIBUTE_TEXT)) {
    const name = attributes.objs.find((o) => o.meta.apiIdentifier === identifier)?.props[NAME];
    if (name !== undefined) texts[key] = name;
  }
  return {
    texts,
    values: Object.fromEntries(values.flatMap((v) => v.objs).map((o) => [o.meta.id, { name: o.props[NAME], hex: o.props[COLOR_HEX] }])),
  };
}
