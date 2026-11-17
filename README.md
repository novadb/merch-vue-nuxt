# Nova Merchandising — Vue + Nuxt

**Live:** <https://vue-nuxt.merch.novadb.com/>: this repository's `main`, running against NovaDB. `/` picks the region
by browser language (`/de/`, `/uk/`, `/us/`); the checkout is in Shopify's test mode.

The same shop in other stacks: React Router ([live](https://react-router.merch.novadb.com/),
[source](https://github.com/novadb/merch-react-router)) · ASP.NET Core Blazor
([live](https://blazor-dotnet.merch.novadb.com/), [source](https://github.com/novadb/merch-blazor-dotnet)) · Razor
Pages + htmx ([live](https://razor-htmx.merch.novadb.com/), [source](https://github.com/novadb/merch-razor-htmx)) ·
Astro ([live](https://astro.merch.novadb.com/), [source](https://github.com/novadb/merch-astro))

The demo site of NovaDB as CMS and PIM in one, built with Nuxt 4 and Vue 3 in TypeScript: universal rendering, so every
page is rendered on the server and then hydrated, and Vue takes over in the browser. Every page, product, price, picture
and UI text is read live from NovaDB's Delivery API (branch `merchDemo`) with plain `$fetch`/`fetch` in Nitro server
routes; there is no NovaDB package in between, and the Delivery login never leaves the server.

Everything works without JavaScript: filters, sorting, "Show more" and search are GET forms whose fields are the page's
query string, and the page answers with itself. With JavaScript the same fields become the route's query and the
page fetches the range for it: the range updates in place (facets and sorting apply on change, cards that stay keep
their element and picture, more cards load while scrolling), links navigate in the page, and the search box is a
typeahead combobox. Shopify's own Buy Button and cart are started by a small client plugin.

## What this demo shows, and what it does not

It shows Nuxt written the way Nuxt is meant to be used, as the same pattern a React Router site follows:

- **File routes.** `app/pages/[region]/[...path].vue` and `search.vue` are the site's pages; `<NuxtLink>` links them.
  The region switch is a plain `<a>` on purpose: a region is another market, and Shopify's cart takes the region's
  market when the page starts. Links inside the CMS's content stay the HTML the CMS wrote.
- **`useAsyncData` on `route.query`.** A filtered view is a URL: the page reads `route.query`, fetches `/api/page`
  or `/api/search` with it and watches it, so a change of the query fetches again while the page stays mounted. Back and
  Forward restore both the address and the form's fields; a query name that no form uses changes nothing, and the
  canonical is the plain page.
- **Nitro server routes as the front end's back end.** `server/api/*` read NovaDB with plain `fetch` and answer JSON;
  on the server the page's calls are function calls.
- **`useSeoMeta`, `useHead`.** Title, description, robots, canonical and hreflang follow the page's data.
- **Hydration.** The live range and the typeahead are Vue components with reactive state, not a script on top of server HTML.

Not shown on purpose: a store (Pinia) for what the page already holds, and a Nuxt module that hides NovaDB: the code
that reads the Delivery API is the part to take away, in the open.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
```

Before the first start copy `.env.example` to `.env` and set `NOVA_DELIVERY_URL`, `NOVA_DELIVERY_USER` and
`NOVA_DELIVERY_PASSWORD` to the Delivery API login of your NovaDB instance (`npm run dev` reads `.env`; `npm run start`
and the container take the same variables from their environment). Optional: `DEMO_BRANCH` (default `merchDemo`),
`SHOPIFY_DOMAIN` and `SHOPIFY_STOREFRONT_TOKEN` (public Buy Button token; without them there is no cart), `SITE_URL`
(public origin for the absolute canonical and hreflang URLs; default: the ingress's `X-Forwarded-*` headers, which a
client can forge, so set it in production), `PORT`, `MEDIA_CACHE_DIR`.

Production: `npm run build`, then `npm run start` (port 3000), or the `Dockerfile`. Checks: `npm run typecheck`.

Container: `uv run scripts/refresh-container.py --full` builds the `Dockerfile` and runs it at http://localhost:4001
with the variables from the environment or `.env`.

## Test

The site passes the shared Playwright behaviour suite of the Nova Merchandising demos (not part of this repository, one
project per demo): run it from its folder with `BASE_URL=http://localhost:4001 npx playwright test --project vue-nuxt`.
The tests tagged `@shopify` (buy button, cart) need the Shopify variables.

## How a request is answered

1. `server/middleware/canonical-url.ts` redirects `/uk/shop/` to `/uk/shop` (one URL per page), keeping the query string.
2. The page (`app/pages/[region]/[...path].vue`) loads its data with `useAsyncData`: `/api/site/{region}` (texts,
   navigation) and `/api/page` (the page or product, and the range for the query's fields). On the server these calls are
   function calls, not HTTP; the data goes into the page's payload.
3. `server/api/*` read NovaDB through `server/utils/` and answer plain JSON (`shared/types/site.ts`).
4. Vue renders the HTML; in the browser it hydrates from the payload, without asking the server again. A later change of
   the query (a filter, "Show more", Back) makes the page fetch `/api/page` again; a link to another page navigates in the browser.

## Where things are

| Path | What |
|---|---|
| `NOVADB.md` | how the site reads NovaDB: the model, the Delivery API's concepts, what the site decided |
| `server/utils/schema.ts` | every NovaDB name (branch, types, attributes, market variants) as API identifiers: the one place to change |
| `server/utils/delivery.ts` | Delivery API client: Basic auth from the environment, 60 s cache |
| `server/utils/labels.ts`, `shared/utils/texts.ts` | the UI texts, read from NovaDB's labels; turned into texts (plural forms, placeholders) |
| `server/utils/site.ts` | page tree, URLs from `merchPageUrlSegment` + parent page, breadcrumb, category page of a group |
| `server/utils/products.ts` | released products with their articles, claims and set rows; full-text filter, facets (counted on the server), sorting |
| `server/utils/content.ts` | a page's Visual Document, resolved for rendering: links, embedded products and pages, pictures |
| `server/utils/images.ts`, `media.ts`, `server/routes/media/` | picture URLs by content address (`/media/{md5}/original{ext}`, `/media/{md5}/{width}{ext}.webp`); the `/media` proxy with disk cache and scaled WebP variants (`sharp`) |
| `server/api/` | `site/{region}`, `page?region=&path=`, `search?region=&q=` (the pages' data; the range form's fields travel in the same query), `suggest?lang=&q=` (the typeahead's JSON) |
| `server/routes/index.get.ts` | `/` → region by `Accept-Language` |
| `shared/` | what server and browser both use: the data types, what a product's articles say (colour, stock), regions and prices, texts, picture URLs, range constants |
| `app/pages/[region]/[...path].vue`, `search.vue`, `app/error.vue` | `/{region}/…` (a page or a product), the search page, 404 and error page |
| `app/components/SiteShell.vue` | document, header, region switch, footer; every page wraps itself in it |
| `app/components/VisualDocument.vue`, `ContentBlock.vue` | the Visual Document renderer |
| `app/components/ProductRange.vue`, `FacetGroup.vue`, `ProductGrid.ts` | the live range: the facet form as the route's query, sorting, cards, in place in the browser |
| `app/components/SearchBox.vue` | the search form and its typeahead combobox |
| `app/components/ProductCard.vue`, `PageTeaser.vue`, `ProductDetail.vue`, `Breadcrumbs.vue` | product card, page teaser, product page, breadcrumb |
| `app/composables/` | site data and texts, canonical and hreflang links |
| `app/router.options.ts` | the scroll behaviour: a change of the query keeps the position |
| `app/plugins/shopify.client.js` | Shopify's Buy Button and cart in the site's colours; the button is placed again after a navigation to a product |
| `app/assets/site.css`, `public/` | the stylesheet, fonts, icons, `robots.txt`: the same files in every demo |

## Deviations

From the shared contract (the reference's HTML and behaviour), because this demo hydrates:

- **Much more JavaScript.** The other demos ship one script of about 17 KB (or none). This one ships Vue, Vue Router
  and the Nuxt runtime: about 215 KB of JavaScript (80 KB gzipped) on every page, plus the payload: each page's HTML
  also carries its data as JSON (`<script id="__NUXT_DATA__">`), so a page is about twice the size of the reference's.
- **Nuxt's markup.** The page sits in `<div id="__nuxt">` (site.css has no rule on `body >`, so it looks the same), Vue
  writes hydration comments (`<!--[-->`, `<!--]-->`, `<!---->`) between elements, and the head has Nuxt's scripts (an
  import map, module preloads, the payload). Small equivalents in serialisation: the header's search input has
  `value=""`, a swatch's style ends in `;`, an empty `alt` is written as `alt`. The product picture has no
  `<link rel="preload">`. A `<NuxtLink>` to the page in view carries `aria-current="page"`.
- **Typeahead markup.** The combobox attributes and the `ul.suggest` list appear after hydration, as with the shared
  script; the list's ID comes from `useId()` (`suggest-v-0-0-1`), not a counter.
- **`<body data-text>`** carries only the texts of Shopify's button and cart; the typeahead's texts come with the payload.
