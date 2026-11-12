/** GET /media/{md5}{ext}: the file `files/{md5}{ext}`, unchangeable under this name. */
import { FILE_NAME, serveMedia } from "../../utils/media";

export default defineEventHandler((event) => {
  const name = getRouterParam(event, "name", { decode: true }) ?? "";
  if (!FILE_NAME.test(name)) return new Response("Not found", { status: 404 });
  return serveMedia(`file-${name}`, `files/${name}`, getRequestHeader(event, "if-none-match") ?? null);
});
