/**
 * Media proxy with a disk cache. The Delivery token never reaches the browser, so pictures are served from here; but a
 * picture is fetched from NovaDB only once. The upstream route is content-addressed and cannot change under its
 * name (`files/{md5}{extension}`: ETag = MD5), so a cached file is never revalidated.
 */
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";
import { deliveryFetch, instanceUrl } from "./delivery";

type Meta = { contentType: string; etag: string; size: number };

/** `MEDIA_CACHE_DIR`, by default a folder in the system's temp directory (writable for the container's `node` user). Delete it to reset the cache. */
const cacheDir = () => process.env.MEDIA_CACHE_DIR ?? path.join(tmpdir(), "nova-media");

/** Fetches in progress by cache key: concurrent requests for the same picture share one download. */
const downloads = new Map<string, Promise<Meta | undefined>>();

const isMissing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";

async function readMeta(key: string): Promise<Meta | undefined> {
  try {
    return JSON.parse(await readFile(path.join(cacheDir(), `${key}.json`), "utf-8")) as Meta;
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

/** Writes `file` through a temporary file and a rename, so no reader ever sees half of it. */
async function writeAtomic(file: string, write: (temp: string) => Promise<unknown>): Promise<void> {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await write(temp);
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

/** Downloads `upstreamPath` into the cache. The meta file is written last: where it exists, the bytes do. */
async function download(key: string, upstreamPath: string): Promise<Meta | undefined> {
  const upstream = await deliveryFetch(instanceUrl(upstreamPath));
  if (upstream.status === 404) return undefined;
  const etag = upstream.headers.get("ETag");
  const contentType = upstream.headers.get("Content-Type");
  if (!upstream.ok || !upstream.body || !etag || !contentType) throw new Error(`Delivery ${upstream.status} for ${upstreamPath} (ETag ${etag}, Content-Type ${contentType})`);

  const dir = cacheDir();
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, key);
  await writeAtomic(file, (temp) => pipeline(Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(temp)));
  return writeMeta(key, { contentType, etag, size: (await stat(file)).size });
}

async function writeMeta(key: string, meta: Meta): Promise<Meta> {
  await writeAtomic(path.join(cacheDir(), `${key}.json`), (temp) => writeFile(temp, JSON.stringify(meta), "utf-8"));
  return meta;
}

/** An image file's name is its content address: the MD5 (GUID form, or 32 hex digits) and the extension. */
export const FILE_NAME = /^([0-9a-f]{32}|[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12})\.[a-z0-9]{1,5}$/;


/** Cached meta for `key`, building the file first (once, however many requests ask) if it is not there yet. */
async function ensure(key: string, build: () => Promise<Meta | undefined>): Promise<Meta | undefined> {
  const cached = await readMeta(key);
  if (cached) return cached;
  const pending = downloads.get(key) ?? build().finally(() => downloads.delete(key));
  downloads.set(key, pending);
  return pending;
}

/** Scales the cached original `file-{name}` to `width` as WebP, without enlarging. Meta is written last, as in `download`. */
async function scale(name: string, width: number, key: string): Promise<Meta | undefined> {
  const original = await ensure(`file-${name}`, () => download(`file-${name}`, `files/${name}`));
  if (!original) return undefined;
  const file = path.join(cacheDir(), key);
  await writeAtomic(file, (temp) => sharp(path.join(cacheDir(), `file-${name}`), { animated: true }).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(temp));
  return writeMeta(key, { contentType: "image/webp", etag: `"${original.etag.replaceAll('"', "")}-w${width}"`, size: (await stat(file)).size });
}

/** Whether an `If-None-Match` header names `etag` (a list of tags, weak or strong, or `*`). */
const matches = (header: string | null, etag: string) =>
  header !== null && header.split(",").some((tag) => tag.trim() === "*" || tag.trim().replace(/^W\//, "") === etag);

/**
 * Serves one picture from the disk cache, fetching it from `upstreamPath` first if it is not there yet. `key` names the
 * cache file and must be safe as a file name (the routes build it from a validated parameter). 404 if NovaDB has no such file.
 */
export function serveMedia(key: string, upstreamPath: string, ifNoneMatch: string | null): Promise<Response> {
  return respond(key, () => download(key, upstreamPath), ifNoneMatch);
}

/** Serves the file `name` (see `server/routes/media/[name].get.ts`) scaled to one of `MEDIA_WIDTHS` (`shared/utils/pictures.ts`); the caller has validated both. */
export function serveScaled(name: string, width: number, ifNoneMatch: string | null): Promise<Response> {
  const key = `w${width}-${name}`;
  return respond(key, () => scale(name, width, key), ifNoneMatch);
}

async function respond(key: string, build: () => Promise<Meta | undefined>, ifNoneMatch: string | null): Promise<Response> {
  const meta = await ensure(key, build);
  if (!meta) return new Response("Not found", { status: 404 });

  const headers = new Headers({ "Cache-Control": "public, max-age=31536000, immutable", ETag: meta.etag });
  if (matches(ifNoneMatch, meta.etag)) return new Response(null, { status: 304, headers });
  headers.set("Content-Type", meta.contentType);
  headers.set("Content-Length", String(meta.size));
  return new Response(Readable.toWeb(createReadStream(path.join(cacheDir(), key))) as ReadableStream, { status: 200, headers });
}
