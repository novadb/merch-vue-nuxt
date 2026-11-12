<!-- Renders a page's Visual Document (resolved by server/utils/content.ts); the default slot (the live range) goes right after its first component, the hero. -->
<script setup lang="ts">
import type { ContentRoot } from "#shared/types/site";

defineProps<{ root?: ContentRoot }>();
</script>

<template>
  <component :is="root.element" v-if="root" :class="root.class">
    <ContentBlock v-if="root.children[0]" :node="root.children[0]" />
    <slot />
    <ContentBlock v-for="(child, i) in root.children.slice(1)" :key="i" :node="child" />
  </component>
  <slot v-else />
</template>
