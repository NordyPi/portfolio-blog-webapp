import "server-only";
import { headers } from "next/headers";

// Simple in-memory limiter for public forms. Fine for a single self-hosted instance.
const hits = new Map<string, number[]>();

/** Returns false if `key` has been used more than `max` times in the last `windowMs`. */
export function allow(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) hits.clear(); // crude bound on memory
  return true;
}

/** Visitor IP: Cloudflare's header first (set by the tunnel), then nginx's. */
export async function clientIp() {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}
