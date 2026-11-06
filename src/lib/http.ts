import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wraps an API handler: returns JSON, maps HttpError / validation errors to proper responses. */
export function route<C = unknown>(fn: (req: Request, ctx: C) => Promise<unknown>, successStatus = 200) {
  return async (req: Request, ctx: C) => {
    try {
      return NextResponse.json(await fn(req, ctx), { status: successStatus });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) {
        return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid request" }, { status: 400 });
      }
      console.error(e);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

const hits = new Map<string, number[]>();

/** Tiny in-memory sliding-window limiter. Per server instance; use a shared store if you scale out. */
export function rateLimit(req: Request, key: string, max: number, windowMs = 60_000) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const k = `${key}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(k) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) throw new HttpError(429, "Too many requests. Please wait a moment.");
  recent.push(now);
  hits.set(k, recent);
}
