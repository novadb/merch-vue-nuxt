<!-- `/{region}/{path}`: a CMS page (with its live product range) or a product from the PIM. -->
<script setup lang="ts">
import type { PageData } from "#shared/types/site";
import { isRegion } from "#shared/utils/regions";

// Any other first segment (`/en/…`) is a 404.
definePageMeta({ validate: (route) => isRegion(route.params.region) });

const route = useRoute();
const region = useRegion();
const path = [route.params.path].flat().join("/");
const form = usePostedForm();
// The keys "page" and "site" are read again by name in ProductRange.vue and useTexts(): keep them together.
const [site, { data: page, error }] = await Promise.all([
  useSite(),
  useAsyncData("page", () => $fetch<PageData>("/api/page", { method: "POST", body: { region, path, form } })),
]);
const failed = site.error.value ?? error.value;
if (failed || !page.value) throw createError({ statusCode: failed?.statusCode ?? 500 });

const text = useTexts();
useHead({ title: () => `${page.value!.title} · ${text.value.siteName}` });
useSeoLinks(page.value.canonical, page.value.alternates, page.value.kind === "product" ? page.value.product.seo : {});
</script>

<template>
  <SiteShell v-if="page" :alternates="page.alternates">
    <Breadcrumbs :items="page.crumbs" />
    <ProductDetail v-if="page.kind === 'product'" :product="page.product" :group-name="page.groupName" :contents="page.contents" :similar="page.similar" :accessories="page.accessories" :spare-parts="page.spareParts" />
    <VisualDocument v-else :root="page.content">
      <ProductRange v-if="page.range" :range="page.range" payload-key="page" />
    </VisualDocument>
  </SiteShell>
</template>
