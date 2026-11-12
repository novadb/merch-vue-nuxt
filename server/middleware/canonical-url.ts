/**
 * One URL per page: `/de/shop/` → `/de/shop`, `/de` → `/de/` (the canonical forms), a permanent redirect. A foreign
 * query string (tracking) is kept on the way, and otherwise ignored: the site reads none.
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
