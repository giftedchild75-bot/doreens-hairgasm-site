import { getDb } from "@/db/client";
import { getOrderByReference, orderAccessOk } from "@/server/orders";
import { startPayment } from "@/server/payments";
import { rateLimit } from "@/server/ratelimit";
import { clientIpFrom, errorResponse, json, sameOrigin } from "@/server/http";
import { rememberedToken } from "@/server/orderAccess";
import { currentCustomer } from "@/server/auth";

/** Retry payment for an existing unpaid order (requires access to that order). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
  const db = await getDb();
  if (!(await rateLimit(db, `pay:${clientIpFrom(req)}`, 10, 600))) return json({ error: "Too many attempts" }, 429);
  try {
    const { reference } = (await req.json()) as { reference?: string };
    const order = reference ? await getOrderByReference(db, reference) : null;
    const customer = await currentCustomer();
    const allowed =
      order && (orderAccessOk(order, await rememberedToken(order.reference)) || (customer && customer.emailVerifiedAt && customer.id === order.customerId));
    if (!order || !allowed) return json({ error: "Order not found" }, 404);
    const { authorizationUrl } = await startPayment(db, order);
    return json({ paymentUrl: authorizationUrl });
  } catch (err) {
    if (err instanceof Error && /no longer be paid|not enabled/.test(err.message)) return json({ error: err.message }, 409);
    return errorResponse(err);
  }
}
