import { getDb } from "@/db/client";
import { env } from "@/lib/env";
import { CheckoutError, createOrder } from "@/server/orders";
import { startPayment } from "@/server/payments";
import { rateLimit } from "@/server/ratelimit";
import { clientIpFrom, errorResponse, json, logError, sameOrigin } from "@/server/http";
import { currentCustomer } from "@/server/auth";
import { rememberOrderAccess } from "@/server/orderAccess";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
  if (env.paymentsMode === "disabled") {
    return json({ error: "Online checkout isn't open yet — please send your order on WhatsApp." }, 503);
  }
  const db = await getDb();
  if (!(await rateLimit(db, `checkout:${clientIpFrom(req)}`, 10, 600))) {
    return json({ error: "Too many attempts — please wait a few minutes and try again." }, 429);
  }
  try {
    const body = await req.json();
    const customer = await currentCustomer();
    const { order, accessToken } = await createOrder(db, body, { customerId: customer?.id ?? null });
    await rememberOrderAccess(order.reference, accessToken);
    try {
      const { authorizationUrl } = await startPayment(db, order);
      return json({ reference: order.reference, paymentUrl: authorizationUrl });
    } catch (err) {
      // The order exists and stock is held; the customer can retry from the order page.
      logError("payment init failed", { order: order.reference, err: String(err) });
      return json({
        reference: order.reference,
        paymentUrl: null,
        error: "We couldn't reach the payment provider. Your order is saved — try paying again from the order page.",
      });
    }
  } catch (err) {
    if (err instanceof CheckoutError) return json({ error: err.message, problems: err.problems }, 409);
    return errorResponse(err);
  }
}
