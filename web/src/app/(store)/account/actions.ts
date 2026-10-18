"use server";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { customers, orders } from "@/db/schema";
import { clientIp, requireCustomer, signInCustomer, signOut } from "@/server/auth";
import { authenticateCustomer, registerCustomer, requestPasswordReset, resetPassword, sendVerificationEmail } from "@/server/customers";
import { rateLimit } from "@/server/ratelimit";
import { queueEmail, renderEmail } from "@/server/email";
import { orderLink } from "@/server/orders";
import type { ActionState } from "@/components/ActionForm";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

async function limited(key: string, limit: number, windowSec: number) {
  const db = await getDb();
  return !(await rateLimit(db, `${key}:${await clientIp()}`, limit, windowSec));
}

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  if (await limited("register", 5, 3600)) return { error: "Too many attempts — please try again later." };
  const parsed = await registerCustomer(await getDb(), { name: s(fd, "name"), email: s(fd, "email"), password: s(fd, "password") }).catch((e) => {
    if (e instanceof z.ZodError) return { ok: false as const, error: e.issues[0]?.message ?? "Check your details." };
    throw e;
  });
  if (!parsed.ok) return { error: parsed.error };
  await signInCustomer(parsed.customer.id);
  redirect("/account");
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  if (await limited("login", 10, 900)) return { error: "Too many sign-in attempts — please wait 15 minutes." };
  const c = await authenticateCustomer(await getDb(), s(fd, "email"), s(fd, "password"));
  if (!c) return { error: "Email or password is incorrect." };
  await signInCustomer(c.id);
  redirect("/account");
}

export async function forgotAction(_: ActionState, fd: FormData): Promise<ActionState> {
  if (await limited("forgot", 5, 3600)) return { error: "Too many requests — please try again later." };
  await requestPasswordReset(await getDb(), s(fd, "email"));
  return { ok: "If an account exists for that email, we've sent a reset link. Check your inbox (and spam folder)." };
}

export async function resetAction(_: ActionState, fd: FormData): Promise<ActionState> {
  if (await limited("reset", 10, 3600)) return { error: "Too many attempts — please try again later." };
  const r = await resetPassword(await getDb(), s(fd, "token"), s(fd, "password"));
  if (!r.ok) return { error: r.error };
  return { ok: "Password updated. You can sign in now." };
}

export async function profileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const c = await requireCustomer();
  const parsed = z
    .object({ name: z.string().trim().min(2).max(120), phone: z.string().trim().regex(/^(\+?[0-9 ()-]{7,20})?$/, "Enter a valid phone number") })
    .safeParse({ name: s(fd, "name"), phone: s(fd, "phone") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  const db = await getDb();
  await db.update(customers).set({ name: parsed.data.name, phone: parsed.data.phone || null, updatedAt: new Date() }).where(eq(customers.id, c.id));
  return { ok: "Profile saved." };
}

export async function logoutAction() {
  await signOut("customer");
  redirect("/");
}

/**
 * Guest order lookup: reference + email. The page never reveals whether the
 * pair matched — a link is emailed to the address on the order instead.
 */
export async function lookupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  if (await limited("lookup", 5, 900)) return { error: "Too many lookups — please wait 15 minutes." };
  const db = await getDb();
  const ref = s(fd, "reference").trim().toUpperCase();
  const email = s(fd, "email").trim().toLowerCase();
  const [o] = await db.select().from(orders).where(and(eq(orders.reference, ref), eq(orders.email, email))).limit(1);
  if (o) {
    const { html, text } = renderEmail("Your order link", [`Here's the secure link to view order ${o.reference}.`], { label: "View my order", url: orderLink(o) });
    await queueEmail(db, { to: o.email, template: "order_lookup", subject: `Your order ${o.reference}`, html, text, orderId: o.id });
  }
  return { ok: "If that order reference matches the email, we've sent a secure link to view it. You can also message us on WhatsApp with your reference." };
}

export async function resendVerificationAction(): Promise<ActionState> {
  const c = await requireCustomer();
  if (c.emailVerifiedAt) return { ok: "Your email is already confirmed." };
  if (await limited("verify", 3, 3600)) return { error: "Too many requests — please try again later." };
  await sendVerificationEmail(await getDb(), c);
  return { ok: "Confirmation email sent — check your inbox." };
}
