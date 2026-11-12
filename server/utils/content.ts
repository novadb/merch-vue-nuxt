/**
 * A page's Visual Document, resolved for rendering (`app/components/VisualDocument.vue`): links inside rich text become
 * site URLs, an embedded object becomes a product card or a page teaser, an image node a picture URL. Done here, on the
 * server, so the page's payload carries only what is shown, not the whole site's targets.
 */
import type { ContentNode, ContentRoot, Link, Product } from "#shared/types/site";
import { cleanHtml } from "./products";
import type { VNode } from "./site";

/** Everything content can point at, by object ID: pages and products (`targets`), the products in full (`products`), pictures (`images`). */
export type Lookup = { targets: Map<number, Link>; products: Map<number, Product>; images: Map<number, string> };

/** Object IDs a document refers to: embedded objects and links inside rich text. */
export function referencedIds(node: VNode | undefined, into = new Set<number>()): Set<number> {
  if (!node) return into;
  if (node.objectId && node.type === "object") into.add(node.objectId);
  for (const m of node.content?.matchAll(/objectId=(\d+)/g) ?? []) into.add(Number(m[1]));
  node.children?.forEach((child) => referencedIds(child, into));
  return into;
}

/** Object IDs of the images a document embeds. */
export function imageIds(node: VNode | undefined, into = new Set<number>()): Set<number> {
  if (!node) return into;
  if (node.objectId && node.type === "image") into.add(node.objectId);
  node.children?.forEach((child) => imageIds(child, into));
  return into;
}

/** Turns CMS links (`object?branch=…&objectId=N`) into site URLs and drops editor-only attributes. */
function rewriteLinks(html: string, targets: Map<number, Link>): string {
  return cleanHtml(html)
    .replace(/href="\/?object\?branch=[^&"]+&amp;objectId=(\d+)"/g, (_, id) => `href="${targets.get(Number(id))?.url ?? "#"}"`)
    .replace(/\sdata-nova-[a-z]+="[^"]*"/g, "");
}

/** The root node (`visualComponentRoot`) comes from the CMS as `<div class="main">`: the `.main` of site.css. */
export function resolveDocument(root: VNode, lookup: Lookup): ContentRoot {
  return { element: root.element || "div", class: root.class, children: resolveChildren(root, lookup) };
}

const resolveChildren = (node: VNode, lookup: Lookup): ContentNode[] => (node.children ?? []).flatMap((child) => resolveNode(child, lookup) ?? []);

/**
 * A node of the document, or nothing where what it embeds is gone (an unpublished product, a picture without a file).
 * The renderer knows a node by kind, element and class (`site.css` styles the class); the node's `definition` is not
 * passed on, the closed set of component classes is kept in the CMS.
 */
function resolveNode(node: VNode, lookup: Lookup): ContentNode | undefined {
  const element = node.element || "div";
  switch (node.type) {
    case "group":
      return { kind: "group", element, class: node.class, children: resolveChildren(node, lookup) };
    case "image": {
      const src = node.objectId ? lookup.images.get(node.objectId) : undefined;
      return src ? { kind: "image", class: node.class, src } : undefined;
    }
    case "object": {
      const product = node.objectId ? lookup.products.get(node.objectId) : undefined;
      if (product) return { kind: "product", element, class: node.class, product };
      const target = node.objectId ? lookup.targets.get(node.objectId) : undefined;
      return target ? { kind: "teaser", element, class: node.class, target } : undefined;
    }
    default:
      return { kind: "html", element, class: node.class, html: rewriteLinks(node.content ?? "", lookup.targets) };
  }
}
