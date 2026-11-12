<script setup lang="ts">
import type { Link } from "#shared/types/site";
import { srcSet } from "#shared/utils/pictures";

defineProps<{ target: Link }>();
</script>

<template>
  <a class="page-teaser" :href="target.url">
    <img v-if="target.image" :src="target.image" :srcset="srcSet(target.image)" sizes="(min-width: 760px) 33vw, 100vw" alt="" loading="lazy">
    <span class="page-teaser__title">{{ target.title }}</span>
  </a>
</template>
