// The Shopify part of the shared site.js (the other demos' only client script): started once the app is mounted, so the
// product page's buy button host (`.pdp__buy[data-shopify-product]`) is in the document. A page the visitor navigates to
// brings its own host without a document load: its button is placed when the page has finished (`page:finish`).
// Plain JavaScript on purpose: it stays comparable with site.js. Its texts come from `<body data-text>` (SiteShell.vue).
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:mounted", () => {
    const text = JSON.parse(document.body.dataset.text || "{}");

    // ---- Shopify Buy Button: product buttons and Shopify's own cart ------------------------------------
    // The cart (a floating toggle and a drawer) is Shopify's, configured in the shop where possible: product titles
    // (translations), the markets GB and US with fixed prices. Handed in: the site's colours, and the region's country, so that
    // the cart prices in the region's market and currency. Also handed in: the label of the buy button and the cart's five
    // visible texts, because the SDK's are English and no shop setting changes them (its accessibility labels stay English).
    // Without the shop's domain and token (two meta tags, from the server's environment) there are no buttons and no cart.
    const shopDomain = document.querySelector('meta[name="shopify-domain"]')?.content;
    const shopToken = document.querySelector('meta[name="shopify-token"]')?.content;
    // First URL segment = region; each region is a market of the shop. `moneyFormat` null: the shop's own (EUR).
    const markets = { de: { country: "DE", moneyFormat: null }, uk: { country: "GB", moneyFormat: "£{{amount}}" }, us: { country: "US", moneyFormat: "${{amount}}" } };
    const market = markets[location.pathname.split("/")[1]];

    let placeButtons; // set once the cart exists: the buttons need it
    if (shopDomain && shopToken) startShopify().catch((error) => console.warn("Shopify unavailable", error));
    nuxtApp.hook("page:finish", () => placeButtons?.());

    async function startShopify() {
      const ShopifyBuy = await loadScript("https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js").then(() => window.ShopifyBuy);
      const client = ShopifyBuy.buildClient({ domain: shopDomain, storefrontAccessToken: shopToken, language: document.body.dataset.lang === "de" ? "de" : "en" });
      if (market) priceInMarket(client, market.country);
      const ui = await ShopifyBuy.UI.onReady(client);

      // The cart formats every amount with one `moneyFormat` (SDK default "${{amount}}"), whatever the cart's currency: the region's, else the shop's.
      const moneyFormat = market?.moneyFormat ?? (await client.shop.fetchInfo()).moneyFormat;

      // Shopify draws everything in iframes: the site's colours (light or dark theme) go in as styles.
      const css = getComputedStyle(document.documentElement);
      const [accent, accentInk, surface, ink, line] = ["--accent", "--accent-ink", "--surface", "--ink", "--line"].map((name) => css.getPropertyValue(name).trim());
      const accented = { "background-color": accent, color: accentInk };
      const button = { ...accented, "border-radius": "999px", ":hover": accented, ":focus": accented };
      const panel = { "background-color": surface, color: ink };
      const inks = (...parts) => Object.fromEntries(parts.map((part) => [part, { color: ink }]));
      const control = { color: ink, "background-color": surface, "border-color": line };

      await ui.createComponent("cart", {
        moneyFormat,
        options: {
          cart: { startOpen: false, text: { title: text.cart, total: text.subtotal, button: text.checkout, empty: text.cartEmpty, notice: text.cartNotice }, styles: { cart: panel, header: panel, footer: panel, ...inks("title", "close", "subtotalText", "subtotal", "notice", "empty"), button } },
          lineItem: { styles: { lineItem: { "border-color": line }, ...inks("itemTitle", "variantTitle", "price", "fullPrice"), quantityInput: control, quantityButton: control } },
          toggle: { styles: { toggle: button, iconPath: { fill: accentInk }, count: { color: accentInk } } },
        },
      });

      const placed = new WeakSet(); // the hosts that have their button
      placeButtons = () => {
        for (const node of document.querySelectorAll("[data-shopify-product]")) {
          if (placed.has(node)) continue;
          placed.add(node);
          ui.createComponent("product", {
            id: node.dataset.shopifyProduct,
            node,
            options: {
              product: {
                contents: { img: false, imgWithCarousel: false, title: false, variantTitle: false, price: false, description: false, quantity: false, buttonWithQuantity: false },
                text: { button: text.addToCart },
                styles: { product: { "max-width": "none", "margin": "0", "text-align": "left" }, button: { ...button, padding: "14px 28px" } },
              },
            },
          });
        }
      };
      placeButtons();
    }

    // A cart prices in the market of its buyer's country. A new cart gets the country of the region; a cart that was started in
    // another region (there is one cart per browser) is moved to it before the cart shows it.
    function priceInMarket(client, countryCode) {
      const create = client.checkout.create.bind(client.checkout);
      client.checkout.create = (input = {}) => create({ ...input, buyerIdentity: { ...input.buyerIdentity, countryCode } });
      const fetchCart = client.checkout.fetch.bind(client.checkout);
      client.checkout.fetch = async (id) => {
        const cart = await fetchCart(id);
        if (!cart || cart.buyerIdentity?.countryCode === countryCode) return cart;
        const moved = await fetch(`https://${shopDomain}/api/2026-07/graphql.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": shopToken },
          body: JSON.stringify({
            query: "mutation($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) { cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) { userErrors { message } } }",
            variables: { cartId: id, buyerIdentity: { countryCode } },
          }),
        }).then((res) => res.json());
        if (moved.errors || moved.data.cartBuyerIdentityUpdate.userErrors.length) console.warn("Shopify: the cart stays in its old market", moved);
        return fetchCart(id);
      };
    }

    function loadScript(src) {
      return new Promise((resolve, reject) => {
        const script = Object.assign(document.createElement("script"), { src, async: true, onload: resolve, onerror: reject });
        document.head.append(script);
      });
    }
  });
});
