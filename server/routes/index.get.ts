/** `/` → the visitor's region: `/de/` for German browsers, `/uk/` for British English and its neighbours, else `/us/`. */

/** English language tags that get British English (the `uk` region) rather than US English. */
const UK_TAGS = /^en-(gb|ie|au|nz|za|in|sg)\b/;

export default defineEventHandler((event) => {
  const preferred = getRequestHeader(event, "accept-language")?.split(",")[0]?.trim().toLowerCase() ?? "";
  return sendRedirect(event, preferred.startsWith("de") ? "/de/" : UK_TAGS.test(preferred) ? "/uk/" : "/us/", 302);
});
