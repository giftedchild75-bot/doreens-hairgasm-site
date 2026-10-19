import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, type Db } from "@/db/client";
import { customers } from "@/db/schema";
import { customerForGoogle, exchangeCode, safeNext, setGoogleFetchForTesting, startGoogleFlow } from "@/server/google";
import { registerCustomer } from "@/server/customers";

const CLIENT_ID = "test-client.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
process.env.GOOGLE_CLIENT_SECRET = "test-secret";
process.env.SITE_URL = "http://localhost:3000";
delete process.env.RESEND_API_KEY;

const idToken = (claims: Record<string, unknown>) =>
  ["e30", Buffer.from(JSON.stringify(claims)).toString("base64url"), "sig"].join(".");

function googleReturns(claims: Record<string, unknown>) {
  const sent: { url: string; body: string }[] = [];
  setGoogleFetchForTesting(async (url, init) => {
    sent.push({ url, body: String(init?.body) });
    return new Response(JSON.stringify({ id_token: idToken(claims) }), { status: 200 });
  });
  return sent;
}

afterEach(() => setGoogleFetchForTesting(null));

describe("Google sign-in flow", () => {
  it("sends the shopper to Google with PKCE, state and nonce", () => {
    const { flow, url } = startGoogleFlow("/checkout");
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(u.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/google/callback");
    expect(u.searchParams.get("scope")).toBe("openid email profile");
    expect(u.searchParams.get("state")).toBe(flow.state);
    expect(u.searchParams.get("nonce")).toBe(flow.nonce);
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("code_challenge")).not.toBe(flow.verifier);
    expect(flow.next).toBe("/checkout");
  });

  it("only redirects to paths on this site after sign-in", () => {
    expect(safeNext("/account")).toBe("/account");
    expect(safeNext("https://evil.example")).toBe("/account");
    expect(safeNext("//evil.example")).toBe("/account");
    expect(safeNext("/\\evil.example")).toBe("/account");
    expect(safeNext(undefined)).toBe("/account");
  });

  const good = (nonce: string) => ({
    iss: "https://accounts.google.com", aud: CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 300,
    nonce, sub: "1234567890", email: "Ada@Gmail.com", email_verified: true, name: "Ada Obi",
  });

  it("accepts a valid ID token and sends the PKCE verifier", async () => {
    const { flow } = startGoogleFlow(null);
    const sent = googleReturns(good(flow.nonce));
    const id = await exchangeCode("the-code", flow);
    expect(id).toEqual({ sub: "1234567890", email: "ada@gmail.com", name: "Ada Obi" });
    expect(sent[0].url).toBe("https://oauth2.googleapis.com/token");
    expect(sent[0].body).toContain(`code_verifier=${flow.verifier}`);
  });

  it.each([
    ["wrong audience", { aud: "someone-else" }],
    ["wrong issuer", { iss: "https://evil.example" }],
    ["expired token", { exp: Math.floor(Date.now() / 1000) - 10 }],
    ["replayed nonce", { nonce: "other" }],
    ["unverified email", { email_verified: false }],
  ])("rejects a %s", async (_, override) => {
    const { flow } = startGoogleFlow(null);
    googleReturns({ ...good(flow.nonce), ...override });
    await expect(exchangeCode("the-code", flow)).rejects.toThrow();
  });
});

describe("Google accounts", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it("creates a verified account on first sign-in and reuses it after", async () => {
    const a = await customerForGoogle(db, { sub: "g-1", email: "new@gmail.com", name: "New Shopper" });
    expect(a.emailVerifiedAt).not.toBeNull();
    expect(a.passwordHash).toBeNull();
    const b = await customerForGoogle(db, { sub: "g-1", email: "new@gmail.com", name: "New Shopper" });
    expect(b.id).toBe(a.id);
  });

  it("links to an existing email account instead of duplicating it", async () => {
    const r = await registerCustomer(db, { name: "Chi", email: "chi@gmail.com", password: "long-enough-password" });
    expect(r.ok).toBe(true);
    const c = await customerForGoogle(db, { sub: "g-2", email: "chi@gmail.com", name: "Chioma" });
    expect(c.id).toBe(r.ok ? r.customer.id : "");
    expect(c.googleSub).toBe("g-2");
    expect(c.name).toBe("Chi"); // keeps the name they chose
    expect(c.emailVerifiedAt).not.toBeNull(); // Google has verified the inbox
    expect(await db.select().from(customers).where(eq(customers.email, "chi@gmail.com"))).toHaveLength(1);
  });

  it("refuses to re-link an email already tied to another Google account", async () => {
    await expect(customerForGoogle(db, { sub: "g-other", email: "chi@gmail.com", name: null })).rejects.toThrow();
  });
});
