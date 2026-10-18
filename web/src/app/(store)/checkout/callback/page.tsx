import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orders, payments } from "@/db/schema";
import { applyVerifiedTransaction } from "@/server/payments";
import { verifyTransaction } from "@/server/paystack";
import { logError } from "@/server/http";

export const dynamic = "force-dynamic";

/**
 * Paystack sends the shopper back here. Arriving on this URL proves nothing:
 * we ask Paystack for the transaction's real status, apply it, and then show
 * the order page, which reflects whatever the database now says.
 */
export default async function PaymentCallback({ searchParams }: PageProps<"/checkout/callback">) {
  const sp = await searchParams;
  const reference = typeof sp.reference === "string" ? sp.reference : typeof sp.trxref === "string" ? sp.trxref : null;
  if (!reference) redirect("/");
  const db = await getDb();
  const [row] = await db
    .select({ orderRef: orders.reference })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(eq(payments.provider, "paystack"), eq(payments.reference, reference)))
    .limit(1);
  if (!row) redirect("/");
  try {
    await applyVerifiedTransaction(db, await verifyTransaction(reference));
  } catch (err) {
    // Provider unreachable: the webhook / reconcile job will still settle it.
    logError("callback verify failed", { reference, err: String(err) });
  }
  redirect(`/orders/${row.orderRef}?from=payment`);
}
