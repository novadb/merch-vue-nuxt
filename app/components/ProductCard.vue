<!-- The product card. Class names and HTML are the same in every demo of this site (shared stylesheet and test suite): change them only together. -->
<script setup lang="ts">
import type { Product } from "#shared/types/site";
import { colorsOf, inStockOf } from "#shared/utils/articles";
import { srcSet } from "#shared/utils/pictures";
import { formatPrice } from "#shared/utils/regions";

const { product: p } = defineProps<{ product: Product }>();
const region = useRegion();
const text = useTexts();
const details = computed(() => [
  ...colorsOf(p).map(text.value.value), p.volume && `${p.volume} ml`, p.screenSize && `${p.screenSize}″`,
  ...p.materials.map(text.value.value), ...p.finishes.map(text.value.value),
  p.pieces && p.pieces > 1 && text.value.pieceCount(p.pieces),
].filter(Boolean).join(" · "));
</script>

<template>
  <article class="product-card">
    <NuxtLink :to="p.url" class="product-card__link">
      <div class="product-card__media">
        <img v-if="p.image" :src="p.image" :srcset="srcSet(p.image)" sizes="(min-width: 700px) 320px, 100vw" :alt="p.name" loading="lazy" width="400" height="400">
      </div>
      <h3 class="product-card__name">{{ p.name }}</h3>
      <p class="product-card__meta">{{ details }}</p>
      <p class="product-card__price">{{ formatPrice(p.price, region) }}<span v-if="inStockOf(p) === false" class="badge badge--muted">{{ text.soldOut }}</span></p>
    </NuxtLink>
  </article>
</template>
