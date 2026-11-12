/** Thin client for NovaDB's Delivery API: Basic auth from the environment, a short in-memory cache. Server only: the login never reaches the browser. */
import { BRANCH } from "./schema";

/** The `props` of a Delivery object: attribute API identifier → value. `any`, because the wire shape depends on the attribute (string, number, ID, list of IDs, `{ XML }`). */
export type Props = Record<string, any>;
export type NovaObject = { meta: { id: number; apiIdentifier?: string }; props: Props };
type ListResponse = { objs: NovaObject[]; refs?: NovaObject[]; more: boolean };

const TTL_MS = 60_000;
/** The most objects the API returns per request (`take`). */
const PAGE_SIZE = 1000;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

/** A variable of the environment; missing, it fails loudly. Read on every call: the container gets them at run time, not at build time. */
function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`${name} is not set (see README, "Run")`);
  return value;
}

/** DEMO_BRANCH, not NOVA_BRANCH: shells often export NOVA_BRANCH for other work. */
const branch = () => env("DEMO_BRANCH", BRANCH);

function authHeader(): string {
  return "Basic " + Buffer.from(`${env("NOVA_DELIVERY_USER")}:${env("NOVA_DELIVERY_PASSWORD")}`).toString("base64");
}

/** Absolute Delivery URL for a path below the branch, e.g. `types/merchProduct/objects`. */
function deliveryUrl(path: string, params: Record<string, string | number | undefined> = {}): string {
  const url = new URL(`branches/${branch()}/${path}`, env("NOVA_DELIVERY_URL"));
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  return url.toString();
}

/** Absolute URL of a route outside the branch, e.g. `files/{md5}{extension}`. */
export const instanceUrl = (path: string) => new URL(path, env("NOVA_DELIVERY_URL")).toString();

/** Fetch with Basic auth, neither cached nor parsed: for the media proxy and `getJson`. */
export function deliveryFetch(url: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(url, { headers: { ...headers, Authorization: authHeader() } });
}

async function getJson<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T>;
  const value = deliveryFetch(url, { Accept: "application/json" }).then(async (res) => {
    if (!res.ok) throw new Error(`Delivery ${res.status} for ${url.replace(env("NOVA_DELIVERY_URL"), "")}: ${await res.text()}`); // the host stays out of the log
    return res.json() as Promise<T>;
  });
  value.catch(() => cache.delete(url));
  // Expired entries leave here, or every search text and filter URL stays in memory until the process ends.
  for (const [key, entry] of cache) if (Date.now() - entry.at >= TTL_MS) cache.delete(key);
  cache.set(url, { at: Date.now(), value });
  return value;
}

/**
 * `props`: 0 (default) the type's API attributes, 1 every named attribute (needed for NovaDB's own types). `resolve`: reference attributes whose targets arrive in `refs`.
 * `variants`: the market member (`MARKET_VARIANT`) whose price the read returns; without it a product has no price.
 * `filter` and `sort` are Delivery expressions (`$score` sorts a full-text filter by relevance).
 */
export type ListQuery = { lang: string; filter?: string; sort?: string; take?: number; variants?: string; props?: 0 | 1; resolve?: string };

/**
 * Every object of a type, read page by page (`more` says another follows), or the first `take` if given: one request.
 * The pages are read one after the other, so the sort must not tie across a page border: the default order is by ID.
 * `refs` are the objects `resolve` names, of all pages together.
 */
export async function list(type: string, q: ListQuery): Promise<{ objs: NovaObject[]; refs: NovaObject[] }> {
  const take = q.take ?? PAGE_SIZE;
  const all: { objs: NovaObject[]; refs: NovaObject[] } = { objs: [], refs: [] };
  for (let skip = 0, more = true; more; skip += take) {
    const url = deliveryUrl(`types/${type}/objects`, { lang: q.lang, props: q.props ?? 0, skip, take, filter: q.filter, sort: q.sort, variants: q.variants, resolve: q.resolve });
    const page = await getJson<ListResponse>(url);
    all.objs.push(...page.objs);
    all.refs.push(...(page.refs ?? []));
    more = page.more && q.take === undefined;
  }
  return all;
}
