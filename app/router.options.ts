import type { RouterConfig } from "@nuxt/schema";

// Nuxt's own scrolling returns to the top when the fragment goes away from an address (`#range`, the fragment of the range
// form's action that a page without JavaScript was opened with), which a filter change must not do: a change of the query
// alone keeps the scroll position. Another page starts at the top, a way back at the position it left.
// A link to the page in view gets no class of Vue Router's: the classes of the markup are the contract's.
export default {
  linkActiveClass: "",
  linkExactActiveClass: "",
  scrollBehavior(to, from, saved) {
    if (to.path === from.path) return to.hash ? { el: to.hash } : false;
    return new Promise((resolve) => useNuxtApp().hooks.hookOnce("page:finish", () => resolve(saved ?? { left: 0, top: 0 })));
  },
} satisfies RouterConfig;
