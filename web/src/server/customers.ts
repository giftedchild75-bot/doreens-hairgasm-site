/** Customer account logic (framework-free so it can be unit-tested). */
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { customers, customerTokens } from "@/db/schema";
import { hashPassword, PASSWORD_MIN, verifyPassword } from "./passwords";
import { randomToken, sha256 } from "@/lib/tokens";
import { queueEmail, renderEmail } from "./email";
import { env } from "@/lib/env";
import { destroyAllCustomerSessions } from "./sessions";
import type { Executor } from "./pricing";

type Purpose = "password_reset" | "verify_email";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  password: z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`).max(200),
});

// Same cost as a real hash, so a missing account takes as long to reject as a wrong password.
const DUMMY_HASH = `scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$${Buffer.alloc(64).toString("base64")}`;

async function issueToken(db: Executor, customerId: string, purpose: Purpose, ttlMs: number) {
  const token = randomToken();
  await db.insert(customerTokens).values({ tokenHash: sha256(token), purpose, customerId, expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

/** Consumes a token once; returns the customer id or null. */
async function consumeToken(db: Executor, token: string, purpose: Purpose) {
  const [r] = await db
    .update(customerTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(customerTokens.tokenHash, sha256(token)),
        eq(customerTokens.purpose, purpose),
        isNull(customerTokens.usedAt),
        gt(customerTokens.expiresAt, new Date()),
      ),
    )
    .returning();
  return r?.customerId ?? null;
}

export async function sendVerificationEmail(db: Db, c: { id: string; email: string }) {
  const token = await issueToken(db, c.id, "verify_email", 48 * 3600_000);
  const { html, text } = renderEmail(
    "Confirm your email",
    ["Please confirm this is your email address. Once confirmed, your account will show your order history."],
    { label: "Confirm my email", url: `${env.siteUrl}/account/verify?t=${token}` },
  );
  await queueEmail(db, { to: c.email, template: "verify_email", subject: "Confirm your email — Doreen's Hairgasm", html, text });
}

export async function registerCustomer(db: Db, raw: unknown) {
  const input = registerSchema.parse(raw);
  const passwordHash = await hashPassword(input.password);
  const [existing] = await db.select().from(customers).where(eq(customers.email, input.email)).limit(1);
  if (existing?.passwordHash) {
    return { ok: false as const, error: "An account with this email already exists — sign in or reset your password." };
  }
  // A previous guest can claim their order history, but only after proving they own
  // the inbox: emailVerifiedAt stays NULL until the emailed link is used.
  const [c] = existing
    ? await db
        .update(customers)
        .set({ passwordHash, name: input.name, emailVerifiedAt: null, updatedAt: new Date() })
        .where(eq(customers.id, existing.id))
        .returning()
    : await db.insert(customers).values({ email: input.email, name: input.name, passwordHash }).returning();
  await sendVerificationEmail(db, c);
  return { ok: true as const, customer: c };
}

export async function verifyEmail(db: Db, token: string) {
  const id = await consumeToken(db, token, "verify_email");
  if (!id) return false;
  await db.update(customers).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(customers.id, id));
  return true;
}

export async function authenticateCustomer(db: Db, email: string, password: string) {
  const [c] = await db.select().from(customers).where(eq(customers.email, email.trim().toLowerCase())).limit(1);
  const ok = await verifyPassword(password, c?.passwordHash ?? DUMMY_HASH);
  return ok && c?.passwordHash ? c : null;
}

/** Behaves identically whether or not the email exists (no account enumeration). */
export async function requestPasswordReset(db: Db, email: string) {
  const [c] = await db.select().from(customers).where(eq(customers.email, email.trim().toLowerCase())).limit(1);
  if (!c?.passwordHash) return;
  const token = await issueToken(db, c.id, "password_reset", 3600_000);
  const { html, text } = renderEmail(
    "Reset your password",
    [
      "Someone (hopefully you) asked to reset the password for your Doreen's Hairgasm account.",
      "This link works once and expires in 1 hour. If you didn't ask for this, you can ignore this email.",
    ],
    { label: "Choose a new password", url: `${env.siteUrl}/account/reset?t=${token}` },
  );
  await queueEmail(db, { to: c.email, template: "password_reset", subject: "Reset your password", html, text });
}

export async function resetPassword(db: Db, token: string, newPassword: string) {
  if (newPassword.length < PASSWORD_MIN) return { ok: false as const, error: `Use at least ${PASSWORD_MIN} characters.` };
  const passwordHash = await hashPassword(newPassword);
  return db.transaction(async (tx) => {
    const id = await consumeToken(tx, token, "password_reset");
    if (!id) return { ok: false as const, error: "This reset link is invalid or has expired. Request a new one." };
    // Using an emailed link proves inbox ownership, so it also verifies the address.
    await tx.update(customers).set({ passwordHash, emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(customers.id, id));
    await destroyAllCustomerSessions(tx, id); // sign out everywhere
    return { ok: true as const, customerId: id };
  });
}

/** Whether this customer may see orders linked to their record. */
export function canSeeOrderHistory(c: { emailVerifiedAt: Date | null }) {
  return c.emailVerifiedAt !== null;
}
