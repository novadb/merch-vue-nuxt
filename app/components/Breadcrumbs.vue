<!-- The breadcrumb of a page or product: the trail from the home page, the last item being the page itself. The home page has none. -->
<script setup lang="ts">
import type { Link } from "#shared/types/site";

defineProps<{ items: Link[] }>();
const text = useTexts();
</script>

<template>
  <nav v-if="items.length > 1" class="crumbs" :aria-label="text.breadcrumb">
    <ol>
      <li v-for="(item, i) in items" :key="item.url">
        <span v-if="i === items.length - 1" aria-current="page">{{ item.title }}</span>
        <a v-else :href="item.url">{{ item.title }}</a>
      </li>
    </ol>
  </nav>
</template>
