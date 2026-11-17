<!-- `/{region}/{path}`: a CMS page (with its live product range, for the filters in the query string) or a product from the PIM. -->
<script setup lang="ts">
import type { PageData } from "#shared/types/site";
import { isRegion } from "#shared/utils/regions";

// Any other first segment (`/en/…`) is a 404.
definePageMeta({ validate: (route) => isRegion(route.params.region) });

const route = useRoute();
const region = useRegion();
// Another path is another page (Nuxt keys a page by its parameters): only the query changes while this one stays.
const path = [route.params.path].flat().join("/");
const range = useTemplateRef("range");
const [site, { data: page, error, status }] = await Promise.all([
  useSite(),
  useAsyncData(`page:${path}`, async (_, { signal }) => {
    const answer = await $fetch<PageData>("/api/page", { query: { ...route.query, region, path }, signal });
    if (answer.kind === "page" && answer.range) await range.value?.preload(answer.range.items);
    return answer;
  }, { watch: [() => JSON.stringify(route.query)] }), // a string: a change of the hash alone gives `route.query` a new identity
]);
const failed = site.error.value ?? error.value;
if (failed || !page.value) throw createError({ statusCode: failed?.statusCode ?? 500, fatal: true });
// A later answer that fails (the range for a new query) is as loud as the first.
watch(error, (failure) => failure && showError(failure));

const text = useTexts();
useHead({ title: () => `${page.value!.title} · ${text.value.siteName}` });
useSeoLinks(() => ({
  path: page.value!.canonical,
  variants: page.value!.alternates,
  hints: page.value!.kind === "product" ? page.value!.product.seo : {},
}));
</script>

<template>
  <SiteShell v-if="page" :alternates="page.alternates">
    <Breadcrumbs :items="page.crumbs" />
    <ProductDetail v-if="page.kind === 'product'" :product="page.product" :group-name="page.groupName" :contents="page.contents" :similar="page.similar" :accessories="page.accessories" :spare-parts="page.spareParts" />
    <VisualDocument v-else :root="page.content">
      <ProductRange v-if="page.range" ref="range" :range="page.range" :pending="status === 'pending'" />
    </VisualDocument>
  </SiteShell>
</template>
