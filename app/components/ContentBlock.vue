<!--
  One component of a Visual Document, in the element and with the class the CMS names. An embedded object is wrapped in
  the component's own element, as the CMS does: the editor's stylesheet (built from site.css) then matches the same DOM.
  It renders by kind, element and class only; the closed set of component classes lives in the CMS, not here.
-->
<script setup lang="ts">
import type { ContentNode } from "#shared/types/site";
import { srcSet } from "#shared/utils/pictures";

// `sizes` of a picture: half a page beside text, but the chapter's text column when its figure stands straight in a chapter (site.css shows it wide there).
const CONTENT_SIZES = "(min-width: 760px) 50vw, 100vw";
const CHAPTER_SIZES = "(min-width: 1280px) 1024px, (min-width: 760px) 78vw, 100vw";

const { node, sizes = CONTENT_SIZES } = defineProps<{ node: ContentNode; sizes?: string }>();
// A chapter hands its size on to its children, a figure to its picture; any other group starts again.
const childSizes = computed(() => (node.class === "merchChapter" ? CHAPTER_SIZES : node.class === "imageWithCaption" ? sizes : CONTENT_SIZES));
</script>

<template>
  <component :is="node.element" v-if="node.kind === 'group'" :class="node.class">
    <ContentBlock v-for="(child, i) in node.children" :key="i" :node="child" :sizes="childSizes" />
  </component>
  <img v-else-if="node.kind === 'image'" :class="node.class" :src="node.src" :srcset="srcSet(node.src)" :sizes="sizes" alt="" :loading="node.eager ? 'eager' : 'lazy'" :fetchpriority="node.eager ? 'high' : undefined">
  <component :is="node.element" v-else-if="node.kind === 'product'" :class="node.class"><ProductCard :product="node.product" /></component>
  <component :is="node.element" v-else-if="node.kind === 'teaser'" :class="node.class"><PageTeaser :target="node.target" /></component>
  <!-- `innerHTML`, not `v-html`: on a dynamic <component> Vue's server renderer drops v-html, the text would only appear after hydration. -->
  <component :is="node.element" v-else :class="node.class" :innerHTML="node.html" />
</template>
