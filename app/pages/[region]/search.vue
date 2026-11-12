<!-- `/{region}/search`: full-text search over products (a live range with facets) and pages; the query is the posted field `q`. -->
<script setup lang="ts">
import type { SearchData } from "#shared/types/site";
import { isRegion, REGIONS } from "#shared/utils/regions";

definePageMeta({ validate: (route) => isRegion(route.params.region) });

const region = useRegion();
const form = usePostedForm();
const [site, { data, error }] = await Promise.all([
  useSite(),
  useAsyncData("search", () => $fetch<SearchData>("/api/search", { method: "POST", body: { region, form } })),
]);
const failed = site.error.value ?? error.value;
if (failed || !data.value) throw createError({ statusCode: failed?.statusCode ?? 500 });

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
        <a v-for="p in data.pages" :key="p.url" :href="p.url">{{ p.title }}</a>
      </nav>
    </section>
    <ProductRange :range="data.range" payload-key="search" :keep="data.q ? { q: data.q } : {}" />
  </SiteShell>
</template>
