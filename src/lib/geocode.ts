import type { LatLng } from "./geo";
import { HttpError } from "./http";

export interface Geocoded extends LatLng {
  label: string;
}

const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { value: Geocoded | null; at: number }>();

// Nominatim's usage policy allows max. 1 request/second: serialize and space out upstream calls.
let chain: Promise<unknown> = Promise.resolve();
let lastCall = 0;
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastCall + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

/**
 * Looks up an address around Vienna with OpenStreetMap Nominatim (free, no API key).
 * For production volume, swap this for a paid geocoder: the rest of the app only needs {lat, lng, label}.
 */
export async function geocodeVienna(address: string): Promise<Geocoded | null> {
  const key = address.trim().toLowerCase().replace(/\s+/g, " ");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "at");
  // left,top,right,bottom: Vienna and its surroundings
  url.searchParams.set("viewbox", "16.15,48.40,16.70,48.05");
  url.searchParams.set("bounded", "1");

  const rows = await throttled(async () => {
    const res = await fetch(url, {
      headers: {
        "User-Agent": process.env.GEOCODER_USER_AGENT ?? "vienna-mail-service/1.0",
        "Accept-Language": "de,en",
      },
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (!res || !res.ok) throw new HttpError(502, "Address lookup is unavailable right now. Please try again.");
    return (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  });

  const first = rows[0];
  const value: Geocoded | null = first
    ? { lat: Number(first.lat), lng: Number(first.lon), label: first.display_name }
    : null;
  cache.set(key, { value, at: Date.now() });
  return value;
}
