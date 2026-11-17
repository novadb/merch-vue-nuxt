<!-- The error page: 404 for an unknown page, product or region, anything else as a plain "Error". Inside the site's shell, in the region of the URL. -->
<script setup lang="ts">
import type { NuxtError } from "#app";
import { t } from "#shared/utils/texts";

const { error } = defineProps<{ error: NuxtError }>();
const { data: site } = await useSite();
// Without site data (NovaDB unreachable) there are no labels: the page stands alone in English.
const text = computed(() => site.value && t(site.value.labels, site.value.region));
const notFound = computed(() => error.statusCode === 404 && text.value);
useHead({ title: () => (notFound.value ? `${text.value!.notFound} · ${text.value!.siteName}` : text.value?.siteName ?? "Error") });
</script>

<template>
  <SiteShell>
    <section class="merchHero not-found">
      <h1 class="merchDisplay">{{ notFound ? text!.notFound : "Error" }}</h1>
      <p v-if="notFound" class="merchLead" v-html="text!.notFoundText.html" />
      <p v-else class="merchLead">Something went wrong while loading this page.</p>
      <p class="merchCta"><NuxtLink :to="site?.home.url ?? '/'">{{ text?.home ?? "Home" }}</NuxtLink></p>
    </section>
  </SiteShell>
</template>
