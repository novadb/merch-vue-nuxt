<!-- The product page: PIM data (price per market, stock, specs, claims, set contents), the Shopify buy button, similar products, accessories and spare parts. -->
<script setup lang="ts">
import type { Product, SetRow } from "#shared/types/site";
import { colorsOf, inStockOf } from "#shared/utils/articles";
import { srcSet } from "#shared/utils/pictures";
import { formatPrice } from "#shared/utils/regions";

const { product: p, similar, accessories, spareParts } = defineProps<{ product: Product; groupName?: string; contents: SetRow[]; similar: Product[]; accessories: Product[]; spareParts: Product[] }>();
const region = useRegion();
const text = useTexts();
const inStock = computed(() => inStockOf(p));
/** Name and value of every spec the product has; one it lacks is left out. */
const specs = computed(() => {
  const t = text.value;
  const deliveryDays = p.articles.filter((a) => a.stock > 0).flatMap((a) => a.deliveryDays ?? []);
  return [
    [t.sku, p.articles.map((a) => a.sku).join(", ")],
    [t.colour, colorsOf(p).map(t.value).join(", ")],
    [t.material, p.materials.map(t.value).join(", ")],
    [t.volume, p.volume ? `${p.volume} ml` : ""],
    [t.screenSize, p.screenSize ? `${p.screenSize}″` : ""],
    [t.finish, p.finishes.map(t.value).join(", ")],
    [t.pieces, p.pieces ? t.pieceCount(p.pieces) : ""],
    [t.delivery, deliveryDays.length ? String(Math.min(...deliveryDays)) : ""],
  ].filter(([, value]) => value);
});
const bands = computed(() => [[text.value.similar, similar], [text.value.accessories, accessories], [text.value.spareParts, spareParts]] as const);
</script>

<template>
  <article class="pdp">
    <div class="pdp__media">
      <img v-if="p.image" :src="p.image" :srcset="srcSet(p.image)" sizes="(min-width: 760px) 55vw, 100vw" :alt="p.name" width="400" height="400">
    </div>
    <div class="pdp__info">
      <p v-if="groupName" class="merchKicker">{{ groupName }}</p>
      <h1 class="pdp__name">{{ p.name }}</h1>
      <p class="pdp__price">{{ formatPrice(p.price, region) }}<span :class="inStock === false ? 'badge badge--muted' : 'badge'">{{ inStock === false ? text.soldOut : text.available }}</span></p>
      <!-- Shopify's buy button goes in here (plugins/shopify.client.js) -->
      <div v-if="p.shopifyId && inStock !== false" class="pdp__buy" :data-shopify-product="p.shopifyId" />
      <div v-if="p.descriptionHtml" class="pdp__description" v-html="p.descriptionHtml" />
      <dl class="specs">
        <div v-for="[name, value] in specs" :key="name">
          <dt>{{ name }}</dt>
          <dd>{{ value }}</dd>
        </div>
      </dl>
      <template v-if="contents.length">
        <h2 class="pdp__subhead">{{ text.setContents }}</h2>
        <ul class="pdp__list">
          <li v-for="row in contents" :key="row.name">{{ row.quantity }} × <NuxtLink v-if="row.url" :to="row.url">{{ row.name }}</NuxtLink><template v-else>{{ row.name }}</template></li>
        </ul>
      </template>
      <template v-if="p.claims.length">
        <h2 class="pdp__subhead">{{ text.claims }}</h2>
        <ul class="pdp__list">
          <li v-for="claim in p.claims" :key="claim">{{ claim }}</li>
        </ul>
      </template>
    </div>
  </article>
  <template v-for="[title, products] in bands" :key="title">
    <section v-if="products.length" class="merchBand">
      <h2 class="headline">{{ title }}</h2>
      <div class="grid">
        <ProductCard v-for="s in products" :key="s.id" :product="s" />
      </div>
    </section>
  </template>
</template>
