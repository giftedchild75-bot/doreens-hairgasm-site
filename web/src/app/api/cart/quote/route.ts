import { getDb } from "@/db/client";
import { quoteCart, quoteInputSchema } from "@/server/pricing";
import { errorResponse, json } from "@/server/http";

/** Authoritative price/stock/discount/delivery quote for the shopper's bag. */
export async function POST(req: Request) {
  try {
    const input = quoteInputSchema.parse(await req.json());
    return json(await quoteCart(await getDb(), input));
  } catch (err) {
    return errorResponse(err);
  }
}
