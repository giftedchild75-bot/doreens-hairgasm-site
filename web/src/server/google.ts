/**
 * "Continue with Google" — OpenID Connect authorization-code flow with PKCE
 * (https://developers.google.com/identity/openid-connect/openid-connect).
 * Framework-free so the account-linking rules can be unit-tested.
 */
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { customers } from "@/db/schema";
import { env } from "@/lib/env";
import { randomToken } from "@/lib/tokens";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
let fetchImpl: FetchLike = (url, init) => fetch(url, init);
/** Test hook: route Google HTTP calls to a fake. */
export function setGoogleFetchForTesting(f: FetchLike | null) {
  fetchImpl = f ?? ((url, init) => fetch(url, init));
}

export const GOOGLE_FLOW_COOKIE = "dh_google";
export const callbackUrl = () => `${env.siteUrl}/api/auth/google/callback`;

/** Only same-site paths are allowed as the post-sign-in destination. */
export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/account";
}

/** Values kept in a short-lived httpOnly cookie between the redirect to Google and the callback. */
export interface GoogleFlow {
  state: string;
  verifier: string;
  nonce: string;
  next: string;
}

export function startGoogleFlow(next: string | null | undefined): { flow: GoogleFlow; url: string } {
  const flow: GoogleFlow = { state: randomToken(), verifier: randomToken(), nonce: randomToken(), next: safeNext(next) };
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: callbackUrl(),
    response_type: "code",
    scope: "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: createHash("sha256").update(flow.verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return { flow, url: `${AUTH_URL}?${params}` };
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string | null;
}

/**
 * Exchanges the code for an ID token and checks its claims. The token comes
 * straight from Google's token endpoint over TLS, authenticated with our client
 * secret, so per OIDC Core §3.1.3.7 its signature need not be re-verified.
 */
export async function exchangeCode(code: string, flow: GoogleFlow, now = Date.now()): Promise<GoogleIdentity> {
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: callbackUrl(),
      grant_type: "authorization_code",
      code_verifier: flow.verifier,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => null)) as { id_token?: string; error?: string } | null;
  if (!res.ok || !body?.id_token) throw new Error(`Google token exchange failed (${res.status}): ${body?.error ?? "no id_token"}`);

  const payload = body.id_token.split(".")[1];
  const c = JSON.parse(Buffer.from(payload ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
  if (!ISSUERS.includes(String(c.iss))) throw new Error("Google ID token: wrong issuer");
  if (c.aud !== env.googleClientId) throw new Error("Google ID token: wrong audience");
  if (typeof c.exp !== "number" || c.exp * 1000 < now) throw new Error("Google ID token: expired");
  if (c.nonce !== flow.nonce) throw new Error("Google ID token: nonce mismatch");
  if (typeof c.sub !== "string" || !c.sub) throw new Error("Google ID token: no subject");
  if (typeof c.email !== "string" || c.email_verified !== true) throw new Error("Google account email is not verified");
  return { sub: c.sub, email: c.email.trim().toLowerCase(), name: typeof c.name === "string" ? c.name : null };
}

/**
 * Finds or creates the customer for a Google identity. Google has verified the
 * address, so an existing account (or guest history) with the same email is
 * linked and marked verified rather than duplicated.
 */
export async function customerForGoogle(db: Db, g: GoogleIdentity) {
  const [bySub] = await db.select().from(customers).where(eq(customers.googleSub, g.sub)).limit(1);
  if (bySub) return bySub;

  const [byEmail] = await db.select().from(customers).where(eq(customers.email, g.email)).limit(1);
  if (byEmail) {
    if (byEmail.googleSub) throw new Error("This email is already linked to a different Google account");
    const [c] = await db
      .update(customers)
      .set({
        googleSub: g.sub,
        name: byEmail.name ?? g.name,
        emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, byEmail.id))
      .returning();
    return c;
  }

  const [c] = await db
    .insert(customers)
    .values({ email: g.email, name: g.name, googleSub: g.sub, emailVerifiedAt: new Date() })
    .returning();
  return c;
}
