/** Remembers which guest orders this browser may view (httpOnly cookie of ref → token). */
import { cookies } from "next/headers";

const COOKIE = "dh_orders";
const MAX = 10;

function parse(raw: string | undefined): [string, string][] {
  if (!raw) return [];
  return raw
    .split("|")
    .map((p) => p.split(":") as [string, string])
    .filter(([r, t]) => r && t);
}

export async function rememberOrderAccess(reference: string, token: string) {
  const jar = await cookies();
  const current = parse(jar.get(COOKIE)?.value).filter(([r]) => r !== reference);
  const next = [[reference, token], ...current].slice(0, MAX);
  jar.set(COOKIE, next.map(([r, t]) => `${r}:${t}`).join("|"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function rememberedToken(reference: string) {
  const jar = await cookies();
  return parse(jar.get(COOKIE)?.value).find(([r]) => r === reference)?.[1] ?? null;
}
