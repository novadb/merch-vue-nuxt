<!--
  A live product range: facet filters as a plain GET form whose fields are the page's query string, sorting, the product
  grid. Without JavaScript every change is a form the browser submits and the page that answers. In the browser the same
  fields become the route's query: the page fetches the range for it, Vue updates the range in place, and the scroll position and the
  focused control stay. "Show more" is clicked by itself as it comes near the window, and replaces the history entry,
  so Back leaves the range instead of stepping through batches.
-->
<script setup lang="ts">
import type { RangeData, Sort } from "#shared/types/site";
import { RANGE_BATCH, SORTS } from "#shared/utils/range";
import { isNavigationFailure, NavigationFailureType } from "vue-router";
import ProductGrid from "./ProductGrid";

const props = defineProps<{
  range: RangeData;
  /** The page is fetching the range for a new query string. */
  pending: boolean;
  /** Hidden fields that must survive a filter change, e.g. the search query. */
  keep?: Record<string, string>;
}>();
const text = useTexts();
const router = useRouter();

const sorts = computed(() => SORTS.filter((s) => s !== "relevance" || props.range.defaultSort === "relevance"));
const sortLabel = computed<Record<Sort, string>>(() => ({
  relevance: text.value.sortRelevance, name: text.value.sortName, "price-asc": text.value.sortPriceAsc, "price-desc": text.value.sortPriceDesc,
}));

/** The price fields, which the visitor types into before they apply: they show what the range was computed for again once its answer is in. */
const min = ref(props.range.selection.min);
const max = ref(props.range.selection.max);
function showSelection() {
  [min.value, max.value] = [props.range.selection.min, props.range.selection.max];
}
watch(() => props.range.selection, showSelection);

const section = ref<HTMLElement>();
const form = ref<HTMLFormElement>();
const grid = ref<InstanceType<typeof ProductGrid> & { preload(items: RangeData["items"]): Promise<void>; focus(index: number): void }>();
const moreButton = ref<HTMLButtonElement>();
/**
 * An answer is on its way. `send` sets it at once, before the router has begun to fetch: the range is never seen idle
 * between a change and its answer. A navigation that did not come from the form (Back, Forward) sets it when the page starts fetching.
 */
const busy = ref(false);
/** The answer to "Show more" adds cards; any other one replaces the range. */
const appending = ref(false);
watch(() => props.pending, (pending) => pending && (busy.value = true));

// The page calls this while it fetches: the pictures of the first cards of the answer are loaded before it is shown.
defineExpose({ preload: (items: RangeData["items"]) => grid.value?.preload(items.slice(0, RANGE_BATCH)) });

/**
 * Sends the form's fields, as the browser's own submit would, as the query of this page. The fields that say nothing
 * (empty, or the default sorting) stay out of the address; "Reset" sends only what must survive it (`keep`).
 */
async function send(submitter: HTMLButtonElement | null) {
  const fields = submitter?.name === "reset" ? Object.entries(props.keep ?? {}) : [...new FormData(form.value!, submitter)];
  const params = new URLSearchParams();
  for (const [name, value] of fields) if (value && !(name === "sort" && value === props.range.defaultSort)) params.append(name, String(value));
  const query = Object.fromEntries([...params.keys()].map((name) => [name, params.getAll(name)]));
  const replace = submitter !== null && submitter === moreButton.value;
  busy.value = true;
  appending.value = replace;
  const failure = await router.push({ query, replace });
  // The address is the one the page has: nothing is fetched, and typed values that were never applied give way to the answer.
  if (isNavigationFailure(failure, NavigationFailureType.duplicated)) {
    busy.value = false;
    showSelection();
  }
}

function onChange(event: Event) {
  const control = event.target as HTMLInputElement | HTMLSelectElement;
  const owner = control.form; // also set for the sort <select form="facets"> outside the form
  if (owner && control.type !== "number" && owner.reportValidity()) send(null);
}

/** A keyboard user who pressed "Show more" goes on with the first new card: its index. */
let focusFrom: number | undefined;
function onSubmit(event: SubmitEvent) {
  event.preventDefault();
  const submitter = event.submitter as HTMLButtonElement | null;
  if (submitter !== null && submitter === moreButton.value) {
    if (busy.value) return; // a filter change is running: its answer comes first
    if (document.activeElement === submitter) focusFrom = props.range.items.length;
  }
  send(submitter);
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
    for (const entry of entries) if (entry.isIntersecting && !busy.value) (entry.target as HTMLButtonElement).click();
  }, { rootMargin: "600px 0px" });
  watchMore();
});
onBeforeUnmount(() => nearEnd?.disconnect());

// The browser moves the scroll position when the page gets shorter: take it before the answer is shown.
let scrolled = 0;
watch(() => props.range, () => (scrolled = scrollY), { flush: "pre" });
watch(() => props.range, async () => {
  await nextTick(); // the grid places its cards after this component has updated
  // The scroll position stays. Only when it cannot (the page is now shorter than it) or shows no result any more
  // (they end above the window) the range is shown from its start.
  const start = parseFloat(getComputedStyle(section.value!).scrollMarginTop); // where the range starts below the sticky header
  if (Math.abs(scrollY - scrolled) > 1 || section.value!.lastElementChild!.getBoundingClientRect().bottom < start) section.value!.scrollIntoView({ behavior: "instant" });
  if (focusFrom !== undefined) grid.value?.focus(focusFrom);
  focusFrom = undefined;
  busy.value = appending.value = false;
  watchMore();
}, { flush: "post" });
</script>

<template>
  <section id="range" ref="section" class="range" :aria-label="text.filter" :aria-busy="busy && !appending ? 'true' : undefined" @change="onChange">
    <!-- `#range`: without JavaScript the answer opens at the range. -->
    <form id="facets" ref="form" class="facets" method="get" action="#range" data-autosubmit="true" @submit="onSubmit">
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
          <input v-model="min" type="number" name="min" inputmode="numeric" min="0" :placeholder="String(range.facets.priceMin)">
        </label>
        <label>
          <span>{{ text.to }}</span>
          <input v-model="max" type="number" name="max" inputmode="numeric" min="0" :placeholder="String(range.facets.priceMax)">
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
      <ProductGrid v-if="range.total" ref="grid" :items="range.items" :busy="appending" />
      <p v-else class="range__empty">{{ text.noResults }}</p>
      <!-- Sends the filters again with one batch more; in the browser it is clicked as it comes near and the new cards are appended. -->
      <button
        v-if="range.total > range.items.length" ref="moreButton" type="submit" form="facets" name="shown"
        :value="range.selection.shown + RANGE_BATCH" class="button button--ghost range__more"
      >{{ text.showMore }}</button>
    </div>
  </section>
</template>
