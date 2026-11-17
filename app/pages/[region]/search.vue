<!-- `/{region}/search`: full-text search over products (a live range with facets) and pages; the query is the parameter `q`. -->
<script setup lang="ts">
import type { SearchData } from "#shared/types/site";
import { isRegion, REGIONS } from "#shared/utils/regions";

definePageMeta({ validate: (route) => isRegion(route.params.region) });

const route = useRoute();
const region = useRegion();
const range = useTemplateRef("range");
const [site, { data, error, status }] = await Promise.all([
  useSite(),
  useAsyncData(`search:${region}`, async (_, { signal }) => {
    const answer = await $fetch<SearchData>("/api/search", { query: { ...route.query, region }, signal });
    await range.value?.preload(answer.range.items);
    return answer;
  }, { watch: [() => JSON.stringify(route.query)] }), // a string: a change of the hash alone gives `route.query` a new identity
]);
const failed = site.error.value ?? error.value;
if (failed || !data.value) throw createError({ statusCode: failed?.statusCode ?? 500, fatal: true });
watch(error, (failure) => failure && showError(failure));

const text = useTexts();
// No canonical or hreflang: internal search results are not meant to be indexed. The region switch leads to the search of the other region.
useHead({ title: () => `${text.value.search} · ${text.value.siteName}` });
const alternates = Object.fromEntries(REGIONS.map((r) => [r, `/${r}/search`]));
</script>

<template>
  <SiteShell v-if="data" :alternates="alternates">
    <section class="merchHero merchHero--compact">
      <p class="merchKicker">{{ text.search }}</p>
      <h1 class="merchDisplay">{{ text.searchTitle(data.q) }}</h1>
      <SearchBox large :query="data.q" />
      <nav v-if="data.pages.length" class="search-pages" :aria-label="text.pagesFound">
        <span>{{ text.pagesFound }}:</span>
        <NuxtLink v-for="p in data.pages" :key="p.url" :to="p.url">{{ p.title }}</NuxtLink>
      </nav>
    </section>
    <ProductRange ref="range" :range="data.range" :pending="status === 'pending'" :keep="data.q ? { q: data.q } : {}" />
  </SiteShell>
</template>
