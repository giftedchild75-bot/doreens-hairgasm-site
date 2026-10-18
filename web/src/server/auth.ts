/** Cookie-bound wrappers around src/server/sessions.ts for use in pages/actions. */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { adminForToken, createSession, customerForToken, destroySession } from "./sessions";

export const ADMIN_COOKIE = "dh_admin";
export const CUSTOMER_COOKIE = "dh_session";

const cookieOpts = (maxAge: number, path = "/") => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path,
  maxAge,
});

export async function signInAdmin(adminId: string) {
  const db = await getDb();
  const { token, maxAgeSeconds } = await createSession(db, { adminId });
  (await cookies()).set(ADMIN_COOKIE, token, cookieOpts(maxAgeSeconds));
}

export async function signInCustomer(customerId: string) {
  const db = await getDb();
  const { token, maxAgeSeconds } = await createSession(db, { customerId });
  (await cookies()).set(CUSTOMER_COOKIE, token, cookieOpts(maxAgeSeconds));
}

export async function currentAdmin() {
  const db = await getDb();
  return adminForToken(db, (await cookies()).get(ADMIN_COOKIE)?.value);
}

export async function currentCustomer() {
  const db = await getDb();
  return customerForToken(db, (await cookies()).get(CUSTOMER_COOKIE)?.value);
}

/** Use at the top of every admin page and admin server action. */
export async function requireAdmin(role?: "owner") {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  if (role === "owner" && admin.role !== "owner") throw new Error("Only the store owner can do this.");
  return admin;
}

export async function requireCustomer() {
  const c = await currentCustomer();
  if (!c) redirect("/account/login");
  return c;
}

export async function signOut(kind: "admin" | "customer") {
  const jar = await cookies();
  const name = kind === "admin" ? ADMIN_COOKIE : CUSTOMER_COOKIE;
  const db = await getDb();
  await destroySession(db, jar.get(name)?.value);
  jar.delete(name);
}

/** Best-effort client identifier for rate limiting (behind Vercel's proxy). */
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
