/** Picture URLs of the media proxy (`server/routes/media/`): `/media/{md5}{ext}` and its scaled variants `/media/{width}/{md5}{ext}`. */

/** Widths of the scaled variants: a fixed list, so the cache cannot be filled with arbitrary sizes. */
export const MEDIA_WIDTHS = [400, 800, 1200, 1600];

/** The file name of a picture URL that has scaled variants: not SVG, which is vector, nor a URL that is not a media file. */
function scalable(src: string): string | undefined {
  const name = src.match(/^\/media\/([^/]+)$/)?.[1];
  return name?.endsWith(".svg") ? undefined : name;
}

/** `srcset` of a picture URL: all its scaled variants. */
export function srcSet(src: string): string | undefined {
  const name = scalable(src);
  return name && MEDIA_WIDTHS.map((w) => `/media/${w}/${name} ${w}w`).join(", ");
}

/** The smallest scaled variant of a picture URL, for small pictures such as the typeahead's; SVG stays as it is. */
export function smallSrc(src: string): string {
  const name = scalable(src);
  return name ? `/media/${MEDIA_WIDTHS[0]}/${name}` : src;
}
