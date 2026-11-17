/**
 * The cards of a live range. On the server Vue renders them. In the browser this component keeps them itself: a product's
 * card stays one element as long as the page lives, also when a filter takes it away and a later one brings it back, so
 * its picture is never loaded or painted twice. Vue's keyed list would keep only the cards that stay and make the others anew.
 */
import type { Product } from "#shared/types/site";
import { h, hydrate, render, type PropType, type VNode } from "vue";
import ProductCard from "./ProductCard.vue";

export default defineComponent({
  props: {
    items: { type: Array as PropType<Product[]>, required: true },
    busy: Boolean,
  },
  setup(props, { expose }) {
    const grid = ref<HTMLElement>();
    if (import.meta.server) {
      return () => h("div", { class: "grid" }, props.items.map((product) => h(ProductCard, { key: product.id, product })));
    }

    const app = useNuxtApp().vueApp;
    const cards = new Map<number, HTMLElement>(); // every card so far, by product ID
    /**
     * The card of a product: the one made before, else a new one, rendered by Vue outside the page. `served` is the
     * server's markup of it: Vue hydrates it in a box of its own, so the card's link navigates in the page like any other.
     */
    function cardOf(product: Product, served?: HTMLElement): HTMLElement {
      let card = cards.get(product.id);
      if (!card) {
        const vnode = h(ProductCard, { product }) as VNode<Node, Element>; // `hydrate` is typed for the browser's nodes
        vnode.appContext = app._context; // the card's composables (texts, region) need the app
        const box = document.createElement("div");
        if (served) {
          box.append(served);
          hydrate(vnode, box);
        } else render(vnode, box);
        card = box.firstElementChild as HTMLElement;
        cards.set(product.id, card);
      }
      return card;
    }
    const place = (items: Product[]) => grid.value!.replaceChildren(...items.map((product) => cardOf(product)));

    onMounted(() => {
      const served = [...grid.value!.children] as HTMLElement[]; // by the server, when the page was loaded with this grid
      served.forEach((card, i) => cardOf(props.items[i]!, card));
      place(props.items);
    });
    watch(() => props.items, place, { flush: "post" });

    expose({
      /**
       * Loads the pictures the cards of `items` still lack, at most 1.5 s: a card a filter or sorting brings on screen
       * then shows its picture at once instead of popping it in. A range starts again with one batch, so these are few.
       */
      async preload(items: Product[]) {
        const missing = items.map((product) => cardOf(product)).flatMap((card) => [...card.querySelectorAll("img")]).filter((img) => !img.complete);
        for (const img of missing) img.loading = "eager";
        await Promise.race([Promise.allSettled(missing.map((img) => img.decode())), new Promise((done) => setTimeout(done, 1500))]);
      },
      /** Moves the focus to the card at `index` (a keyboard user goes on with the first card "Show more" added). */
      focus(index: number) {
        grid.value?.children[index]?.querySelector("a")?.focus();
      },
    });
    // No children: in the browser the cards are not Vue's (hydration leaves the server's in place).
    return () => h("div", { ref: grid, class: "grid", "aria-busy": props.busy ? "true" : undefined });
  },
});
