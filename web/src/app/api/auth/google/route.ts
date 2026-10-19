import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { env } from "@/lib/env";
import { clientIp } from "@/server/auth";
import { GOOGLE_FLOW_COOKIE, startGoogleFlow } from "@/server/google";
import { rateLimit } from "@/server/ratelimit";

/** Step 1: send the shopper to Google's account chooser. */
export async function GET(req: NextRequest) {
  const back = new URL("/account/login", env.siteUrl);
  if (!env.googleSignInEnabled) return NextResponse.redirect(back);
  const db = await getDb();
  if (!(await rateLimit(db, `google:${await clientIp()}`, 30, 600))) {
    back.searchParams.set("error", "busy");
    return NextResponse.redirect(back);
  }
  const { flow, url } = startGoogleFlow(req.nextUrl.searchParams.get("next"));
  (await cookies()).set(GOOGLE_FLOW_COOKIE, JSON.stringify(flow), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // sent on Google's top-level redirect back to us
    path: "/api/auth/google",
    maxAge: 600,
  });
  return NextResponse.redirect(url);
}
