/**
 * Filters, sorting and search are POST forms that a page answers with itself (no query string, no redirect). The page
 * renders on the server from the posted fields: they are read here, once, and kept for it (`app/composables/usePostedForm.ts`).
 */
export default defineEventHandler(async (event) => {
  if (event.method === "POST" && !event.path.startsWith("/api/")) event.context.form = (await readRawBody(event, "utf8")) ?? "";
});
