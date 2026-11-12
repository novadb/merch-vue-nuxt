<!-- The product page: PIM data (price per market, stock, specs), the Shopify buy button, similar products. -->
<script setup lang="ts">
import type { Product } from "#shared/types/site";
import { srcSet } from "#shared/utils/pictures";
import { formatPrice } from "#shared/utils/regions";

const { product: p } = defineProps<{ product: Product; groupName?: string; similar: Product[] }>();
const region = useRegion();
const text = useTexts();
/** Name and value of every spec the product has; one it lacks is left out. */
const specs = computed(() => {
  const t = text.value;
  return [
    [t.sku, p.sku ?? ""],
    [t.colour, p.color ? t.value(p.color) : ""],
    [t.material, p.materials.map(t.value).join(", ")],
    [t.volume, p.volume ? `${p.volume} ml` : ""],
    [t.screenSize, p.screenSize ? `${p.screenSize}″` : ""],
    [t.finish, p.finishes.map(t.value).join(", ")],
    [t.pieces, p.pieces ? t.pieceCount(p.pieces) : ""],
  ].filter(([, value]) => value);
});
</script>

<template>
  <article class="pdp">
    <div class="pdp__media">
      <img v-if="p.image" :src="p.image" :srcset="srcSet(p.image)" sizes="(min-width: 760px) 55vw, 100vw" :alt="p.name" width="400" height="400">
    </div>
    <div class="pdp__info">
      <p v-if="groupName" class="merchKicker">{{ groupName }}</p>
      <h1 class="pdp__name">{{ p.name }}</h1>
      <p class="pdp__price">{{ formatPrice(p.price, region) }}<span :class="p.inStock === false ? 'badge badge--muted' : 'badge'">{{ p.inStock === false ? text.soldOut : text.available }}</span></p>
      <!-- Shopify's buy button goes in here (plugins/shopify.client.js) -->
      <div v-if="p.shopifyId && p.inStock !== false" class="pdp__buy" :data-shopify-product="p.shopifyId" />
      <div v-if="p.descriptionHtml" class="pdp__description" v-html="p.descriptionHtml" />
      <dl class="specs">
        <div v-for="[name, value] in specs" :key="name">
          <dt>{{ name }}</dt>
          <dd>{{ value }}</dd>
        </div>
      </dl>
    </div>
  </article>
  <section v-if="similar.length" class="merchBand">
    <h2 class="headline">{{ text.similar }}</h2>
    <div class="grid">
      <ProductCard v-for="s in similar" :key="s.id" :product="s" />
    </div>
  </section>
</template>
