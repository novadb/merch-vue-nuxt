<!--
  The search form: a POST to /{region}/search, the query in the field `q`. In the browser the input becomes an ARIA
  combobox over POST /api/suggest (products and pages while typing, keys ↑ ↓ Enter Esc); without JavaScript it is a plain form.
-->
<script setup lang="ts">
import type { Suggestions } from "#shared/types/site";

/** `large`: the search page's own form, with a button and the query it was posted with. */
const props = defineProps<{ large?: boolean; query?: string }>();
const SUGGEST = "/api/suggest";
const region = useRegion();
const text = useTexts();
const listId = `suggest-${useId()}`;

const form = ref<HTMLFormElement>();
/** What the input holds: bound with v-model, so a re-render (the list opening) never resets what the visitor typed. */
const typed = ref(props.query ?? "");
// The combobox exists only where it works: in the browser, after hydration.
const ready = ref(false);
onMounted(() => (ready.value = true));
const result = ref<Suggestions & { q: string }>();
const open = ref(false);
const active = ref(-1);
let controller: AbortController | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

/** An option leads to a product or page; the last one ("search all") has no address and submits the search form. */
const options = computed(() => result.value ? [...result.value.products.map((p) => p.url), ...result.value.pages.map((p) => p.url), undefined] : []);
const optionId = (index: number) => `${listId}-${index}`;

function choose(index: number) {
  const href = options.value[index];
  if (href) location.href = href;
  else form.value?.requestSubmit();
}

function close() {
  open.value = false;
  active.value = -1;
}

async function highlight(index: number) {
  active.value = (index + options.value.length) % options.value.length;
  await nextTick();
  document.getElementById(optionId(active.value))?.scrollIntoView({ block: "nearest" });
}

async function load(q: string) {
  controller?.abort();
  const request = (controller = new AbortController());
  try {
    const body = new URLSearchParams({ lang: region, q }); // POST: no URL carries a query string
    result.value = { ...(await $fetch<Suggestions>(SUGGEST, { method: "POST", body, signal: request.signal })), q };
    active.value = -1;
    open.value = true;
  } catch (error) {
    // $fetch wraps an abort in a FetchError, so the name says nothing: a newer keystroke took over when this call's signal is aborted.
    if (request.signal.aborted) return;
    close();
    console.error(error);
  }
}

function onInput(event: Event) {
  clearTimeout(timer);
  const q = (event.target as HTMLInputElement).value.trim();
  if (q.length < 2) {
    controller?.abort();
    return close();
  }
  timer = setTimeout(() => load(q), 150);
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value) return;
  if (event.key === "ArrowDown") highlight(active.value + 1);
  else if (event.key === "ArrowUp") highlight(active.value - 1);
  else if (event.key === "Escape") close();
  else if (event.key === "Enter" && active.value >= 0) choose(active.value);
  else return;
  event.preventDefault();
}

/** A click on an option blurs the input first: the list closes a little later, after the click has chosen. */
const onBlur = () => setTimeout(close, 100);

/** `aria-selected` of an option: set on all of them once one is highlighted. */
const selected = (index: number) => (active.value < 0 ? undefined : index === active.value);
</script>

<template>
  <form ref="form" :class="props.large ? 'search search--large' : 'search'" role="search" method="post" :action="`/${region}/search`">
    <input
      v-model="typed" type="search" name="q" :placeholder="text.searchPlaceholder" :aria-label="text.search" autocomplete="off" :data-suggest="SUGGEST"
      :role="ready ? 'combobox' : undefined" :aria-controls="ready ? listId : undefined" :aria-autocomplete="ready ? 'list' : undefined"
      :aria-expanded="ready ? open : undefined" :aria-activedescendant="active >= 0 ? optionId(active) : undefined"
      @input="onInput" @keydown="onKeydown" @blur="onBlur"
    >
    <ul v-if="ready" :id="listId" class="suggest" role="listbox" :hidden="!open">
      <template v-if="result">
        <li v-if="result.products.length" class="suggest__heading" role="presentation">{{ text.products }}</li>
        <li
          v-for="(p, i) in result.products" :id="optionId(i)" :key="p.url" class="suggest__option" role="option" :data-href="p.url"
          :aria-selected="selected(i)" @mousedown.prevent="choose(i)"
        >
          <img v-if="p.image" :src="p.image" alt="" width="40" height="40"><span class="suggest__name">{{ p.name }}</span><span class="suggest__price">{{ p.price }}</span>
        </li>
        <li v-if="result.pages.length" class="suggest__heading" role="presentation">{{ text.pagesFound }}</li>
        <li
          v-for="(page, i) in result.pages" :id="optionId(result.products.length + i)" :key="page.url" class="suggest__option" role="option"
          :data-href="page.url" :aria-selected="selected(result.products.length + i)" @mousedown.prevent="choose(result.products.length + i)"
        >
          <span class="suggest__name">{{ page.title }}</span>
        </li>
        <li
          :id="optionId(options.length - 1)" class="suggest__option" role="option" :aria-selected="selected(options.length - 1)"
          @mousedown.prevent="choose(options.length - 1)"
        >
          <span class="suggest__name suggest__all">{{ text.searchAll }} “{{ result.q }}”</span>
        </li>
      </template>
    </ul>
    <button v-if="props.large" type="submit" class="button">{{ text.search }}</button>
  </form>
</template>
