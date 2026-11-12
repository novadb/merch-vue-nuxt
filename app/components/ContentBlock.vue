<!--
  One component of a Visual Document, in the element and with the class the CMS names. An embedded object is wrapped in
  the component's own element, as the CMS does: the editor's stylesheet (built from site.css) then matches the same DOM.
-->
<script setup lang="ts">
import type { ContentNode } from "#shared/types/site";
import { srcSet } from "#shared/utils/pictures";

defineProps<{ node: ContentNode }>();
</script>

<template>
  <component :is="node.element" v-if="node.kind === 'group'" :class="node.class">
    <ContentBlock v-for="(child, i) in node.children" :key="i" :node="child" />
  </component>
  <img v-else-if="node.kind === 'image'" :class="node.class" :src="node.src" :srcset="srcSet(node.src)" sizes="(min-width: 760px) 50vw, 100vw" alt="" loading="lazy">
  <component :is="node.element" v-else-if="node.kind === 'product'" :class="node.class"><ProductCard :product="node.product" /></component>
  <component :is="node.element" v-else-if="node.kind === 'teaser'" :class="node.class"><PageTeaser :target="node.target" /></component>
  <!-- `innerHTML`, not `v-html`: on a dynamic <component> Vue's server renderer drops v-html, the text would only appear after hydration. -->
  <component :is="node.element" v-else :class="node.class" :innerHTML="node.html" />
</template>
