# AGENTS.md

Single source of truth for coding agents in this repository; `CLAUDE.md` only imports it. A line stays only if an agent would decide wrongly without it.

## Project

"Nova Merchandising": a demo website that shows NovaDB as CMS and PIM in one. Every page, product, price, picture and UI text is read live from NovaDB's Delivery API. Stack: Nuxt 4 (universal rendering: server render, then hydration), Vue 3, TypeScript; Nitro server routes read NovaDB with plain `fetch`, no NovaDB package.

The idea of this demo is hydration: the live range and the typeahead are Vue components with reactive state, not a script on top of server HTML. Everything still works without JavaScript.

Agencies and developers read this code to learn how the stack works with NovaDB, then change it for their own project. Measure every change against that: easy to read (a short path from URL to HTML, no layer of our own, fewer lines); the NovaDB code in the open, one place per concern; everything else (shop, pictures, SEO, deployment) in the smallest form that is right in concept; modern, idiomatic Nuxt, Vue and TypeScript; a complete site on the live API.

The same site exists in other stacks and must look and behave identically: HTML structure, CSS classes, label keys, routes and the shared files are a contract, checked by the shared Playwright suite. Change none of them here alone.

Non-goals: client-side navigation, writes to NovaDB, a database or shared cache, query strings, a cart of our own.

## Commands and gates

- Run: `npm run dev` (http://localhost:3000; reads `.env`). It needs the Delivery login (`NOVA_DELIVERY_URL`, `NOVA_DELIVERY_USER`, `NOVA_DELIVERY_PASSWORD`) and fails loudly without it.
- `npm run typecheck`, `npm run build`, `docker build .`
- Local container (`localhost:4001`, podman): `uv run scripts/refresh-container.py` after every completed change; `--full` after a change to `package.json`, `package-lock.json` or `Dockerfile`.
- Tests: the shared Playwright suite, from its checkout: `BASE_URL=http://localhost:4001 npx playwright test`. The tests tagged `@shopify` need the Shopify variables.
- Done means: typecheck, build and `docker build` pass and the suite is green against the real Delivery API, but for the tests the README names under "Deviations". "Should work" is not a result; report each gate with its output.
- The suite asserts structure and data rules, not CMS copy (a missing seed path is CMS data). It runs with JavaScript, so it misses what only the server render lacks: check a changed page's HTML with `curl` too.

## NovaDB

Before touching `server/utils/` or the content components read `NOVADB.md`: the model and the Delivery API's concepts (identifiers, `lang`, `props`, variants, references, Visual Document, files, search). The wire protocol (routes, filter and sort grammar, paging) is in the product documentation it links. `README.md` lists which file does what.

- Read-only, branch `merchDemo`.
- Every NovaDB name (branch, types, attributes, market variants) is an API identifier and stands only in `server/utils/schema.ts`. An unavoidable numeric ID goes there too, as a named constant.
- A missing `props` key means unset or untranslated: omit it. Never fall back to another language or to `displayName`.
- NovaDB is read only in `server/`. Never print or log `NOVA_DELIVERY_URL/USER/PASSWORD`, never put them in `runtimeConfig.public`, the payload or `app/`: pictures go through the `/media` proxy.
- `server/utils/delivery.ts` caches responses for 60 s: after a NovaDB data change wait a minute or restart before judging output.
- A UI text is a `merchLabel` object in NovaDB: a new text is a new label there plus its key in `shared/utils/texts.ts`. The name of a product attribute is not a label: it is the name of the attribute's definition (`ATTRIBUTE_TEXT` in `server/utils/labels.ts`). A missing text prints `⟦key⟧` and fails the suite.

## Rules

- Fix the cause, not the symptom: no swallowed exception, fallback value or retry that hides a defect. Missing configuration or data fails loudly.
- Never weaken, skip or work around a test of the suite to get green.
- Change only what the task needs; list unrelated findings at the end of your answer (`file:line`).
- Ask before adding a dependency or touching `Dockerfile` or deploy configuration.
- Imports: our own modules (`#shared/…`, `server/utils/…`) are imported explicitly, so a reader can follow them; Nuxt, Vue and h3 functions, `app/composables/` and `app/components/` are auto-imported, as Nuxt intends.
- Comments say why the code is this way (a constraint of NovaDB, the framework, browser or contract) or what a name stands for, true for a reader who never saw an earlier version. A declaration other files use gets a doc comment when name and type leave something open (a unit, what a missing value means); a file header or one comment for a group may cover several. Never what the code plainly does or how it changed: that goes in the pull request. No TODO, no commented-out code; test names likewise.

## Where the code does not say why

- The site writes no query string and reads none (a foreign one is ignored): filters, sorting and search are POST forms answered with the page itself, so a filtered view has no URL of its own. That is intended. `server/middleware/posted-form.ts` keeps the posted fields for the render; the pages pass them to `server/api/page` or `search`.
- With JavaScript, `ProductRange.vue` sends the very same POST and replaces the page's data with the answer's payload under the page's `useAsyncData` key (`page`, `search`): keep that key and its `payloadKey` prop together. Never give the range a JSON endpoint of its own: the suite expects the POST to the page URL and its HTML.
- `ProductGrid.ts` keeps the card elements itself in the browser (Vue renders them only on the server): a card that leaves the result and comes back must be the same element. Do not turn it into a `v-for`.
- Navigation is a document load (`<a href>`), never `<NuxtLink>`: header and SEO links come from each page's server render, content links are CMS HTML.
- On a dynamic `<component :is>`, use `:innerHTML`, not `v-html`: Vue's server renderer drops the latter and the text appears only after hydration.
- The HTML structure is a contract that every implementation of this site shares, plus what Nuxt adds (README, "Deviations"). Keep inline content (a price and its badge) on one template line, or Vue adds a space.
- `app/assets/site.css`, `NOVADB.md` and everything in `public/` (`favicon.svg`, `novadb.svg`, `github.svg`, `robots.txt`, the fonts) are shared files, kept identical from outside this repository: never adapt them. `site.css` is also the CMS editor's stylesheet. The shared client script (`site.js`) is not used here on purpose; its behaviour lives in the components.
- Page content is made from a closed set of components (classes `merch*`): compose, or follow the structure with CSS, before asking for a new one.
- The shop is Shopify's own Buy Button and cart, started in `app/plugins/shopify.client.js` from a product's `data-shopify-product`; that file is the shared client script's Shopify part, unchanged (plain JavaScript, so it stays comparable): change it only together with it. Without `SHOPIFY_DOMAIN` and `SHOPIFY_STOREFRONT_TOKEN` there are no buy buttons and no cart, silently: keep both in `.env`.

## Git

- Branch from a fresh `origin/main` as `feature/<id>-<slug>` or `bugfix/<id>-<slug>` (`<id>` is the number of the work item, the slug lower-case words). `main` changes only by pull request, completed as **squash merge** with the source branch deleted; direct and force pushes to `main` are rejected.
- **Title and description of the PR are the one public commit message.** Write them with the skill `pr-text` (title up to 60 characters, description optional, up to three lines), check them with `scripts/check-pr-text.py`, get the user's approval, and set the merge commit message explicitly to that text.
- The PR needs a review, a linked work item, resolved comments and a green build.
- Everything on `main` is public and mirrored read-only to GitHub (never push there): no addresses, accounts, tracker numbers or secrets in files or commit messages. No tags, no version numbers.
- Pushing, merging and tagging need explicit approval.

## Deployment

The site is one container (`Dockerfile`, port 3000 via `PORT`) with no state of its own: the media cache (`MEDIA_CACHE_DIR`) refills by itself. Where and how it is hosted is the operator's choice. It only needs its environment (see NovaDB) from the platform's secrets, with `SITE_URL` set to the public origin. Never push images, deploy or change DNS without explicit approval.
