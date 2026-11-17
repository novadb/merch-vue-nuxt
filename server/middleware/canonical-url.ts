/**
 * One URL per page: `/de/shop/` → `/de/shop`, `/de` → `/de/` (the canonical forms), a permanent redirect. The query
 * string (a filter, a tracking parameter) is kept on the way.
 */
import { REGIONS } from "#shared/utils/regions";

const PAGE_PATH = new RegExp(`^/(${REGIONS.join("|")})(/.*)?$`);

export default defineEventHandler((event) => {
  const { pathname, search } = getRequestURL(event);
  const match = PAGE_PATH.exec(pathname);
  if (!match) return;
  const inner = (match[2] ?? "").replace(/^\/+|\/+$/g, "");
  const wanted = inner ? `/${match[1]}/${inner}` : `/${match[1]}/`;
  if (pathname !== wanted) return sendRedirect(event, wanted + search, 301);
});
