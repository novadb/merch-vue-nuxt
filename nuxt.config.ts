// Nuxt: universal rendering. Every page is rendered on the server (from NovaDB, through the server routes in server/),
// then Vue hydrates it and takes over the live range and the search typeahead.
export default defineNuxtConfig({
  compatibilityDate: "2026-11-01",
  devtools: { enabled: false },
  telemetry: false,
  // The shared stylesheet, one file for the whole site: served under a name with its content hash, as a <link>.
  css: ["~/assets/site.css"],
  features: { inlineStyles: false },
  app: {
    head: { link: [{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }] },
    // Nothing is teleported: no empty <div id="teleports"> after the app.
    teleportId: false,
  },
});
