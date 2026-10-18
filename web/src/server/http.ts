import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { env } from "@/lib/env";

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/**
 * Same-origin check for state-changing browser requests (CSRF defence for
 * JSON endpoints; server actions get Next's built-in origin check).
 */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  try {
    const o = new URL(origin);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return o.host === host || o.origin === new URL(env.siteUrl).origin;
  } catch {
    return false;
  }
}

export function clientIpFrom(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export function logError(msg: string, extra: Record<string, unknown> = {}) {
  console.error(JSON.stringify({ level: "error", time: new Date().toISOString(), msg, ...extra }));
}

export function errorResponse(err: unknown) {
  if (err instanceof ZodError) {
    return json({ error: "Please check the highlighted fields.", fields: err.flatten().fieldErrors }, 400);
  }
  logError((err as Error)?.message ?? String(err), { stack: (err as Error)?.stack });
  return json({ error: "Something went wrong on our side. Please try again, or message us on WhatsApp." }, 500);
}
