/**
 * GET /media/{md5}/original{ext}: the file `files/{md5}{ext}`.
 * GET /media/{md5}/{width}{ext}.webp: the same file scaled to one of `MEDIA_WIDTHS` as WebP. SVG stays vector: it has no variant.
 * The name keeps the extension because NovaDB serves a file only under it. Neither can change under its name.
 */
import { MEDIA_WIDTHS } from "#shared/utils/pictures";
import { FILE_NAME, serveOriginal, serveScaled } from "../../../utils/media";

const notFound = () => new Response("Not found", { status: 404 });

export default defineEventHandler((event) => {
  const md5 = getRouterParam(event, "md5", { decode: true }) ?? "";
  const file = getRouterParam(event, "file", { decode: true }) ?? "";
  const ifNoneMatch = getRequestHeader(event, "if-none-match") ?? null;

  const original = file.match(/^original(?<ext>\.[a-z0-9]{1,5})$/)?.groups?.ext;
  if (original) return FILE_NAME.test(md5 + original) ? serveOriginal(md5, original, ifNoneMatch) : notFound();

  const { w, ext } = file.match(/^(?<w>\d+)(?<ext>\.[a-z0-9]{1,5})\.webp$/)?.groups ?? {};
  const width = MEDIA_WIDTHS.find((candidate) => String(candidate) === w); // not `Number()`: it would also read `0x190` and `4e2` as 400
  if (!width || !ext || ext === ".svg" || !FILE_NAME.test(md5 + ext)) return notFound();
  return serveScaled(md5, ext, width, ifNoneMatch);
});
