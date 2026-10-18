import type { Metadata } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { newsletterSubscribers } from "@/db/schema";
import { sha256 } from "@/lib/tokens";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

export default async function Unsubscribe({ searchParams }: PageProps<"/newsletter/unsubscribe">) {
  const t = (await searchParams).t;
  let ok = false;
  if (typeof t === "string" && t) {
    const db = await getDb();
    const rows = await db
      .update(newsletterSubscribers)
      .set({ unsubscribedAt: new Date() })
      .where(and(eq(newsletterSubscribers.unsubscribeTokenHash, sha256(t)), isNull(newsletterSubscribers.unsubscribedAt)))
      .returning({ id: newsletterSubscribers.id });
    ok = rows.length > 0;
  }
  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 480, textAlign: "center" }}>
        <div className="page-head"><h1>{ok ? "You have been unsubscribed" : "Already unsubscribed"}</h1></div>
        <p className="muted">
          {ok
            ? "You will not receive any more newsletter emails from us. Order emails are unaffected."
            : "This link has already been used or is invalid — you will not receive newsletter emails."}
        </p>
      </div>
    </div>
  );
}
