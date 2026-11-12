<!-- Document, header and footer around every page and the error page. `alternates`: the same content in every region, for the region switch. -->
<script setup lang="ts">
import type { Alternates } from "#shared/types/site";
import { HTML_LANG, REGION_LABEL, REGIONS } from "#shared/utils/regions";
import { t } from "#shared/utils/texts";

/** This demo's repository on GitHub (`github.com/novadb/<REPO>`), linked from the footer of every page. */
const REPO = "merch-vue-nuxt";

defineProps<{ alternates?: Alternates }>();
const region = useRegion();
const { data: site } = await useSite();
// Without site data (NovaDB unreachable) there are no labels: the error page then stands alone in English.
const text = computed(() => site.value && t(site.value.labels, site.value.region));
const shop = site.value?.shopify;

useHead({
  htmlAttrs: { lang: HTML_LANG[region] },
  bodyAttrs: {
    "data-lang": region,
    "data-shop": shop?.domain && shop.token ? "" : undefined,
    // The texts plugins/shopify.client.js prints: the buy button and the cart's visible texts.
    "data-text": text.value && JSON.stringify({
      addToCart: text.value.addToCart, cart: text.value.cart, subtotal: text.value.subtotal, checkout: text.value.checkout,
      cartEmpty: text.value.cartEmpty, cartNotice: text.value.cartNotice,
    }),
  },
  meta: shop?.domain && shop.token ? [{ name: "shopify-domain", content: shop.domain }, { name: "shopify-token", content: shop.token }] : [],
});
</script>

<template>
  <a class="skip" href="#main">{{ text?.skip ?? "Skip to content" }}</a>
  <header v-if="site && text" class="site-header">
    <div class="site-header__inner">
      <a class="logo" :href="site.home.url">{{ site.home.title }}</a>
      <nav class="site-nav" :aria-label="text.mainNav">
        <ul>
          <li v-for="item in site.nav" :key="item.url">
            <a :href="item.url">{{ item.title }}</a>
            <ul v-if="item.children.length" class="site-nav__sub">
              <li v-for="c in item.children" :key="c.url"><a :href="c.url">{{ c.title }}</a></li>
            </ul>
          </li>
        </ul>
      </nav>
      <SearchBox />
      <div class="site-header__tools">
        <nav class="regions" :aria-label="text.region">
          <template v-for="r in REGIONS" :key="r">
            <span v-if="r === region" class="regions__item" aria-current="true" :title="REGION_LABEL[r].title">{{ REGION_LABEL[r].short }}</span>
            <a v-else class="regions__item" :href="alternates?.[r] ?? `/${r}/`" :hreflang="HTML_LANG[r]" :title="REGION_LABEL[r].title">{{ REGION_LABEL[r].short }}</a>
          </template>
        </nav>
      </div>
    </div>
  </header>
  <main id="main"><slot /></main>
  <footer class="site-footer">
    <p v-if="text" v-html="text.poweredBy.html" />
    <a class="site-footer__repo" :href="`https://github.com/novadb/${REPO}`">{{ REPO }}</a>
  </footer>
  <!-- The NovaDB logo in the corner: decoration only, the footer's line names NovaDB in words. -->
  <aside class="source" aria-hidden="true" />
</template>
