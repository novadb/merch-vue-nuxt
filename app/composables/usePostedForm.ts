/**
 * The fields of the form this page was posted with (filters, sorting, search), urlencoded as
 * `server/middleware/posted-form.ts` kept them; empty when the page was simply opened. Only the render on the server
 * reads them: the browser gets their result with the page's payload.
 */
export const usePostedForm = (): string => (import.meta.server ? (useRequestEvent()?.context.form ?? "") : "");
