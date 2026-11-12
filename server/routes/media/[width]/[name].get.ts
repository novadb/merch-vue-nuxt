/** GET /media/{width}/{md5}{ext}: the file `files/{md5}{ext}` scaled to one of `MEDIA_WIDTHS` as WebP; unchangeable under this name. SVG stays vector: it has no scaled variant. */
import { MEDIA_WIDTHS } from "#shared/utils/pictures";
import { FILE_NAME, serveScaled } from "../../../utils/media";

export default defineEventHandler((event) => {
  const name = getRouterParam(event, "name", { decode: true }) ?? "";
  const width = MEDIA_WIDTHS.find((w) => String(w) === getRouterParam(event, "width")); // not `Number()`: it would also read `0x190` and `4e2` as 400
  if (!width || !FILE_NAME.test(name) || name.endsWith(".svg")) return new Response("Not found", { status: 404 });
  return serveScaled(name, width, getRequestHeader(event, "if-none-match") ?? null);
});
