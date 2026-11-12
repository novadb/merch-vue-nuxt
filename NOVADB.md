# NovaDB in this site

How the website reads NovaDB through the Delivery API: the model, the concepts and what the site decided. This file
names concepts, not code, so it is the same in every implementation of the site. It does not repeat the wire protocol
(routes, filter and sort grammar, paging): that is in the product documentation,
https://docs.novadb.com/apis/Noxum.Nova.Delivery/

## The model

One branch, `merchDemo`, holds CMS and PIM. The site only reads it. Content languages: `en-US`, `de-DE`.

| Type | What it is on the site | Read from it |
|---|---|---|
| `merchPage` | a page of the site | title, navigation title, URL segment, sort key, image, content, product groups, parent page |
| `merchProduct` | a product | name, description, SKU, group, price, in stock, images, similar products, URL path, Shopify ID, colour, materials, finishes, volume, pieces, screen size |
| `merchProductGroup` | a group of products | name |
| `image` | a picture; a file type, so the object is the file | MD5, file extension |
| `merchLabel` | one UI text | key (language-neutral), text (per language) |
| `merchColor`, `merchMaterial`, `merchFinish` | PIM values a product references | name; a colour also its hex value |
| `typeAttribute` | NovaDB's own type of attribute definitions | name: a product attribute is printed under the name an editor sees in the CMS |

A page with product groups is a category page: it lists those groups' products as a live range. Any page can embed
products as cards in its content. The home page is the page without a parent.

## Concepts

- **Branch.** A branch is the unit of publication: pin one, never mix two. A type or branch that is not released to
  the Delivery API answers 404, not an empty list.
- **Identifiers, not IDs.** Numeric IDs of branches, types and attributes differ per NovaDB installation, API
  identifiers do not. The site addresses everything by identifier and keeps all of them in one place. They carry the
  prefix `merch` (identifiers are unique across branches) and arrive with a lower-case first letter.
- **Access.** HTTP Basic with a token that reads everything in the branch, unfiltered. It is a server-side secret: the
  browser never gets it, which is why pictures are served through the site's own `/media` routes.
- **`lang`.** One culture name per request (`en-US`, `de-DE`). A language-dependent attribute holds the value entered
  for that language and nothing else: untranslated, its key is missing from `props`. `displayName` is never empty,
  because it falls back to a language that has a text; so it is a label, not a translation. The site omits what is
  missing and never prints `displayName` or another language in its place.
- **`props`.** `props=0` returns the attributes a type releases to the API: the contract, and the default.
  `props=1` returns every named attribute; NovaDB's own types (`typeAttribute`) need it.
- **Variants.** A product's price depends on the variant axis `merchMarket`. Without `variants=<member>` the price is
  missing, and a filter or sort on it is a 400. One member per request: `merchMarketEU`, `merchMarketUK` or
  `merchMarketUS`, chosen by the region of the URL (`de`, `uk`, `us`).
- **References.** A reference is the target's numeric ID (a list of IDs for a multi-value attribute). The targets
  are separate objects, read in one of three ways. `resolve=<reference attribute>` delivers them in `refs` of the same
  response, with the attributes their type releases: the site reads a product's pictures this way. Where the IDs are
  known beforehand (a page's image, the pictures a document embeds, the products it embeds), a filter
  `meta.id = a, b, c` reads exactly those. Colour, material, finish and group are small types, read whole and looked
  up by `meta.id`.
- **Structures.** The page tree is the structure Sitemap: each page names its parent (`merchPageParent`), at any
  depth. There is no tree route, and sibling order is not part of a structure: the site reads all pages in one request
  sorted by `merchPageSortKey` and links them itself. A page's URL is the chain of its ancestors' URL segments; a
  product's URL path is one attribute holding the whole path. Both are language-dependent.
- **Visual Document.** Page content is a tree of components, one tree per language. Every node has `type`,
  `definition`, `element` and `class`; the type decides the rest: `group` has `children`, `text` has `content` (an
  XHTML fragment), `image` and `object` have an `objectId`. The site renders it generically: `<element class>` with
  the content or the children inside. An `objectId` is not in `refs`: the site collects the IDs of a document and
  reads them. An embedded product becomes a product card, an embedded page a teaser, inside the component's own
  element. Links in text point at `object?branch=…&objectId=N` and are rewritten to the target's URL; `data-nova-*`
  attributes are dropped.
- **Rich text.** A product description arrives as `{ "XML": "…" }`, an XHTML fragment with a namespace: emit it as
  HTML without the namespace.
- **Files.** A picture is an object of a file type. A route outside the branch addresses bytes by content and can
  never change under its name: `files/{md5}{extension}` (the original). The site uses only this, so a fetched file is
  kept for good. The `image` type must release MD5 and extension to the API for this. The API has no resize parameter,
  and the thumbnail (`binaries/{id}`) is one rendition in a format and size the server chooses, so it is not used:
  other sizes are scaled by the site.
- **Search.** Full-text search is the filter operator `:` on text attributes, the value is Lucene syntax, the order
  `sort=$score`. A visitor's input passed through verbatim is a 400 or 500: the site strips Lucene syntax and builds
  prefix terms (`+term*`). A language-dependent attribute is searched in the request's `lang`.
- **Paging.** `take` is at most 1000; `count` in a response is the size of that page, `more` tells whether another
  follows. The site reads a type page by page (`skip` raised by `take` while `more` is true) and joins the pages; the
  pages are separate requests, so the sort must not tie (the default order is by ID). A read with its own `take`, such
  as the search hits, is one request. `refs` arrive with each page for that page's objects, and objects plus `refs`
  of one request are limited to 10000. Facets are counted by the site over the products it loaded, not by the API.
