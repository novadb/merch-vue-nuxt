/** Picture URLs of the media proxy (`server/routes/media/`): `/media/{md5}/original{ext}` and its scaled variants `/media/{md5}/{width}{ext}.webp`. */

/** Widths of the scaled variants: a fixed list, so the cache cannot be filled with arbitrary sizes. */
export const MEDIA_WIDTHS = [400, 800, 1200, 1600];

/** The folder and extension of a picture URL that has scaled variants, which keep the extension because NovaDB serves a file only under it: not SVG, which is vector, nor a URL that is not a media file. */
function scalable(src: string): { folder: string; ext: string } | undefined {
  const { folder, ext } = src.match(/^(?<folder>\/media\/[^/]+)\/original(?<ext>\.[a-z0-9]{1,5})$/)?.groups ?? {};
  return folder && ext && ext !== ".svg" ? { folder, ext } : undefined;
}

/** `srcset` of a picture URL: all its scaled variants; undefined for SVG and for a URL that is not a media file. */
export function srcSet(src: string): string | undefined {
  const file = scalable(src);
  return file && MEDIA_WIDTHS.map((w) => `${file.folder}/${w}${file.ext}.webp ${w}w`).join(", ");
}

/** The smallest scaled variant of a picture URL, for small pictures such as the typeahead's; SVG stays as it is. */
export function smallSrc(src: string): string {
  const file = scalable(src);
  return file ? `${file.folder}/${MEDIA_WIDTHS[0]}${file.ext}.webp` : src;
}
