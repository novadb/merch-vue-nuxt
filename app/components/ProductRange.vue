<!--
  A live product range: facet filters as a plain POST form (the URL stays the page's), sorting, the product grid.
  Without JavaScript every change is a form the browser posts and the page that answers. In the browser the same POST
  is sent in the background: the answer is the page itself, and its payload (the page's data, as the server rendered
  it) replaces the page's data here, so Vue updates the range in place: no page load, the scroll position and the
  focused control stay. "Show more" is clicked by itself as it comes near the window.
-->
<script setup lang="ts">
import type { RangeData, Sort } from "#shared/types/site";
import { RANGE_BATCH, SORTS } from "#shared/utils/range";
import { parsePayload } from "#app/composables/payload";
import ProductGrid from "./ProductGrid";

const props = defineProps<{
  range: RangeData;
  /** The key of the page's data (`useAsyncData`) that holds this range: the answer's data under that key replaces it. */
  payloadKey: string;
  /** Hidden fields that must survive a filter change, e.g. the search query. */
  keep?: Record<string, string>;
}>();
const text = useTexts();
const nuxtApp = useNuxtApp();
const pageData = useNuxtData<{ range: RangeData }>(props.payloadKey).data;

const sorts = computed(() => SORTS.filter((s) => s !== "relevance" || props.range.defaultSort === "relevance"));
const sortLabel = computed<Record<Sort, string>>(() => ({
  relevance: text.value.sortRelevance, name: text.value.sortName, "price-asc": text.value.sortPriceAsc, "price-desc": text.value.sortPriceDesc,
}));

const section = ref<HTMLElement>();
const grid = ref<InstanceType<typeof ProductGrid> & { preload(items: RangeData["items"]): Promise<void>; focus(index: number): void }>();
const moreButton = ref<HTMLButtonElement>();
/** A filter or sort change is on its way (the whole range is replaced); "Show more" is on its way (cards are added). */
const busy = ref(false);
const loading = ref(false);
let pending: AbortController | undefined; // the running request; a newer one aborts it
let native = false; // set when an answer is unusable: the browser then submits the form itself and shows what the server says

/** Posts the form as the browser would and returns the page data of the answer; undefined when the answer is unusable. */
async function post(form: HTMLFormElement, submitter: HTMLElement | null, signal: AbortSignal) {
  const body = new URLSearchParams(new FormData(form, submitter) as unknown as Record<string, string>);
  const res = await fetch(location.pathname, { method: "POST", body, signal });
  if (!res.ok) return undefined;
  const payload = new DOMParser().parseFromString(await res.text(), "text/html").getElementById("__NUXT_DATA__")?.textContent;
  if (!payload) return undefined;
  const data = (await nuxtApp.runWithContext(() => parsePayload(payload))).data?.[props.payloadKey];
  return data?.range ? (data as { range: RangeData }) : undefined;
}

/** A filter or sort change: the range from the answer replaces this one; cards that stay keep their element. */
async function update(form: HTMLFormElement, submitter: HTMLElement | null = null) {
  const request = new AbortController();
  pending?.abort();
  pending = request;
  busy.value = true;
  let next;
  try {
    next = await post(form, submitter, request.signal);
  } catch (error) {
    if ((error as Error).name === "AbortError") return;
  }
  if (!next) {
    native = true;
    return form.requestSubmit(submitter);
  }
  await grid.value?.preload(next.range.items);
  if (request.signal.aborted) return;
  const y = scrollY;
  pageData.value = next;
  await nextTick();
  // The scroll position stays. Only when it cannot (the page is now shorter than it) or shows no result any more
  // (they end above the window) the range is shown from its start.
  const start = parseFloat(getComputedStyle(section.value!).scrollMarginTop); // where the range starts below the sticky header
  if (Math.abs(scrollY - y) > 1 || section.value!.lastElementChild!.getBoundingClientRect().bottom < start) section.value!.scrollIntoView({ behavior: "instant" });
  busy.value = false;
  watchMore();
}

/** "Show more": the range with one batch more; the cards already shown stay, the new ones are appended. */
async function more(form: HTMLFormElement, button: HTMLButtonElement) {
  if (loading.value || busy.value) return; // a filter change is running: its answer comes first
  const request = new AbortController();
  pending?.abort();
  pending = request;
  loading.value = true;
  let next;
  try {
    next = await post(form, button, request.signal);
  } catch (error) {
    if ((error as Error).name === "AbortError") return void (loading.value = false); // a filter change took over
  }
  const shown = props.range.items.length;
  if (!next || next.range.items.length <= shown) {
    native = true;
    return form.requestSubmit(button);
  }
  const keyboard = document.activeElement === button;
  pageData.value = next;
  await nextTick();
  if (keyboard) grid.value?.focus(shown); // a keyboard user goes on with the first new card
  loading.value = false;
  watchMore();
}

function onChange(event: Event) {
  const control = event.target as HTMLInputElement | HTMLSelectElement;
  const form = control.form; // also set for the sort <select form="facets"> outside the form
  if (form && control.type !== "number" && form.reportValidity()) update(form);
}

function onSubmit(event: SubmitEvent) {
  if (native) return;
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  if (event.submitter && event.submitter === moreButton.value) more(form, moreButton.value);
  else update(form, event.submitter);
}

// "Show more" clicks itself when it comes within 600 px of the window. Observed anew after every change: an observer
// reports only a change of intersection, and the button may still be near after the cards were added.
let nearEnd: IntersectionObserver | undefined;
function watchMore() {
  nearEnd?.disconnect();
  if (moreButton.value) nearEnd?.observe(moreButton.value);
}
onMounted(() => {
  nearEnd = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting && !native && !loading.value) (entry.target as HTMLButtonElement).click();
  }, { rootMargin: "600px 0px" });
  watchMore();
});
onBeforeUnmount(() => nearEnd?.disconnect());
</script>

<template>
  <section id="range" ref="section" class="range" :aria-label="text.filter" :aria-busy="busy ? 'true' : undefined" @change="onChange">
    <form id="facets" class="facets" method="post" action="#range" data-autosubmit="true" @submit="onSubmit">
      <input v-for="(value, name) in keep" :key="name" type="hidden" :name="name" :value="value">
      <FacetGroup
        v-if="range.facets.group.length > 1" :legend="text.group" name="group"
        :values="range.facets.group.filter((v) => range.groupNames[Number(v.value)])" :label-of="(v) => range.groupNames[Number(v)]!"
      />
      <FacetGroup :legend="text.colour" name="color" :values="range.facets.color" :label-of="text.value" :swatch-of="text.swatch" />
      <FacetGroup v-if="range.facets.material.length" :legend="text.material" name="material" :values="range.facets.material" :label-of="text.value" />
      <fieldset class="facet">
        <legend>{{ text.availability }}</legend>
        <label class="facet__option">
          <input type="checkbox" name="stock" value="1" :checked="range.selection.stock">
          <span>{{ text.inStock }}</span>
          <span class="facet__count">{{ range.facets.inStock }}</span>
        </label>
      </fieldset>
      <fieldset class="facet facet--price">
        <legend>{{ text.price }}</legend>
        <label>
          <span>{{ text.from }}</span>
          <input type="number" name="min" inputmode="numeric" min="0" :placeholder="String(range.facets.priceMin)" :value="range.selection.min">
        </label>
        <label>
          <span>{{ text.to }}</span>
          <input type="number" name="max" inputmode="numeric" min="0" :placeholder="String(range.facets.priceMax)" :value="range.selection.max">
        </label>
      </fieldset>
      <div class="facets__actions">
        <button type="submit" class="button">{{ text.apply }}</button>
        <button type="submit" name="reset" value="1" class="button button--ghost">{{ text.reset }}</button>
      </div>
    </form>
    <div class="range__main">
      <div class="range__bar">
        <p class="range__count" aria-live="polite">{{ text.results(range.total) }}</p>
        <label class="range__sort">
          <span>{{ text.sort }}</span>
          <select name="sort" form="facets">
            <option v-for="s in sorts" :key="s" :value="s" :selected="s === (range.selection.sort ?? range.defaultSort)">{{ sortLabel[s] }}</option>
          </select>
        </label>
      </div>
      <ProductGrid v-if="range.total" ref="grid" :items="range.items" :busy="loading" />
      <p v-else class="range__empty">{{ text.noResults }}</p>
      <!-- Posts the filters again with one batch more; in the browser it is clicked as it comes near and the new cards are appended. -->
      <button
        v-if="range.total > range.items.length" ref="moreButton" type="submit" form="facets" name="shown"
        :value="range.selection.shown + RANGE_BATCH" class="button button--ghost range__more"
      >{{ text.showMore }}</button>
    </div>
  </section>
</template>
