import { z } from "zod";
import { getDb } from "@/db/client";
import { newsletterSubscribers } from "@/db/schema";
import { NEWSLETTER_CONSENT_TEXT } from "@/lib/consent";
import { queueEmail, renderEmail } from "@/server/email";
import { rateLimit } from "@/server/ratelimit";
import { clientIpFrom, json, sameOrigin } from "@/server/http";
import { randomToken, sha256 } from "@/lib/tokens";
import { env } from "@/lib/env";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200), consent: z.literal(true) });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ message: "Bad origin" }, 403);
  const db = await getDb();
  if (!(await rateLimit(db, `nl:${clientIpFrom(req)}`, 5, 600))) return json({ message: "Too many attempts — try later." }, 429);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ message: "Enter a valid email and tick the consent box." }, 400);
  const token = randomToken();
  const [row] = await db
    .insert(newsletterSubscribers)
    .values({ email: parsed.data.email, consentAt: new Date(), consentText: NEWSLETTER_CONSENT_TEXT, unsubscribeTokenHash: sha256(token) })
    .onConflictDoUpdate({
      target: newsletterSubscribers.email,
      set: { consentAt: new Date(), consentText: NEWSLETTER_CONSENT_TEXT, unsubscribeTokenHash: sha256(token), unsubscribedAt: null },
    })
    .returning();
  const { html, text } = renderEmail(
    "You're on the list",
    [
      "Thanks for subscribing to Doreen's Hairgasm — we'll email you when new pieces land.",
      "Didn't sign up, or changed your mind? Use the link below to unsubscribe instantly.",
    ],
    { label: "Unsubscribe", url: `${env.siteUrl}/newsletter/unsubscribe?t=${token}` },
  );
  await queueEmail(db, { to: row.email, template: "newsletter_welcome", subject: "Welcome to Doreen's Hairgasm", html, text });
  return json({ message: "You're subscribed — welcome!" });
}
