/** The fields of a posted form (`application/x-www-form-urlencoded`); empty for a GET. The site reads no query string. */
import type { H3Event } from "h3";

export async function readForm(event: H3Event): Promise<URLSearchParams> {
  if (event.method !== "POST") return new URLSearchParams();
  return new URLSearchParams((await readRawBody(event, "utf8")) ?? "");
}
