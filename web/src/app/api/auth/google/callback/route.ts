import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { env } from "@/lib/env";
import { signInCustomer } from "@/server/auth";
import { customerForGoogle, exchangeCode, GOOGLE_FLOW_COOKIE, safeNext, type GoogleFlow } from "@/server/google";

const sameString = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Step 2: Google sends the shopper back here with a one-time code. */
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const raw = jar.get(GOOGLE_FLOW_COOKIE)?.value;
  jar.delete({ name: GOOGLE_FLOW_COOKIE, path: "/api/auth/google" });

  const fail = (reason: string) => {
    const back = new URL("/account/login", env.siteUrl);
    back.searchParams.set("error", reason);
    return NextResponse.redirect(back);
  };

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return fail("google_cancelled"); // e.g. the shopper closed the chooser
  const code = params.get("code");
  const state = params.get("state");
  let flow: GoogleFlow | null = null;
  try {
    flow = raw ? (JSON.parse(raw) as GoogleFlow) : null;
  } catch {
    flow = null;
  }
  if (!env.googleSignInEnabled || !code || !state || !flow?.state || !sameString(state, flow.state)) return fail("google");

  try {
    const identity = await exchangeCode(code, flow);
    const customer = await customerForGoogle(await getDb(), identity);
    await signInCustomer(customer.id);
    return NextResponse.redirect(new URL(safeNext(flow.next), env.siteUrl));
  } catch (e) {
    console.error("[google sign-in]", e instanceof Error ? e.message : e);
    return fail("google");
  }
}
